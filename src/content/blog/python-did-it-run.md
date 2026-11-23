---
title: "Did that Python function ever run? Ask the interpreter."
publishedAt: 2026-11-22
tags: ["Incident response", "Memory forensics", "CPython"]
readingMinutes: 6
author: "Mario Oliva"
description: "Using CPython interpreter state to investigate whether a Python function ran."
shareImage:
  src: "/assets/blog/python-did-it-run-og.png"
  alt: "SBHC Security blog cover reading Did that Python function ever run? Ask the interpreter. CPython memory forensics by Mario Oliva."
draft: false
---

I started looking into Python incident response because I kept seeing how quickly tools like Claude and Codex could turn an idea into working Python code. As more of that code makes its way into production, I wanted to know what evidence responders could use to tell whether a specific function had run when the logs couldn’t answer that question.

Claude and I went down a CPython rabbit hole. I wanted to know whether a running Python process could answer a question its logs couldn’t: did this function ever run?

The answer is in the interpreter's own memory. A running CPython process can retain clues in memory about which functions ran. Those clues can be read from outside the process without modifying it.

## What the interpreter keeps

Since version 3.11, CPython optimizes code while it runs, following PEP 659. Instructions that can benefit are replaced by an adaptive form, and an adaptive instruction that has executed often enough is replaced by a faster specialized one. From version 3.13 the interpreter also marks each function the first time it is entered. All of this stays in the process's memory for as long as it runs.

## A published technique, tested on current Python

Reading a runtime's own optimization state to tell which code ran is a published technique. Kodem Security described it for several runtimes, including Python, in a patent application filed in 2024, and Manna, Case, Ali-Gombe and Richard noted it for .NET in 2022. The full history is under Prior work below.

This note takes it to Python 3.12, 3.13 and 3.14 and adds three things. It uses the first-entry mark and the layout table that 3.13 introduced. It reaches functions through the garbage collector's lists and the running frames as well as through modules. It grades each function as run never, once or repeatedly. It also measures how far that answer can be trusted.

## What the tool does

`didrun.py` takes a process ID and lists every function with its file, line and grade. It uses only the standard library and runs as root under the target's minor version of Python. It reads the process and changes nothing in it.

```sh
sudo python3.13 -I didrun.py 4242 --path /srv/app/
```

It also flags code that a profiler or tracer has touched, so a disturbed function is not mistaken for an untouched one.

## How it works

1. **Find the interpreter.** The script searches the ELF files listed in `/proc/<pid>/maps` for a `.PyRuntime` section or the `_PyRuntime` symbol, which stripped builds keep. `Py_Version` in the same file gives the exact version.

2. **Get the structure layouts.** Python 3.13 and later publish a layout table, `_Py_DebugOffsets`, inside the runtime structure. Python 3.12 has none, so the script carries offsets from the 3.12 headers.

3. **Reach every code object.** Reading through `/proc/<pid>/mem`, the script walks the module dictionaries, the garbage collector's object lists and each thread's running frames. Each function, generator and frame leads to a code object, as in Ali, Case and Ahmed's approach.

4. **Read the marks.** On 3.13 and later every function starts with `RESUME`, which becomes `RESUME_CHECK` on first entry. PEP 659's section on Ancillary data places 16-bit entries after an adaptive instruction, the first serving as a counter, and its section on Specialization says the instruction tries to specialize when that counter runs down.

5. **Grade.** A site that never executed reads 17, and one that executed once reads 1. No entry mark and every counter at 17 gives "never", a counter at 1 gives "once", and a specialized site gives "repeatedly".

One handler from my tests, read on Python 3.13 before and after a single request:

| | Entry instruction | Counter sites |
|---|---|---|
| Before any request | `RESUME` | 6 at the never-run value |
| After one request | `RESUME_CHECK` | 3 specialized |

Grades describe instruction sites, so a loop inside a single call already reads "repeatedly". Profilers and `sys.monitoring` reset the counters at the sites they instrument and leave a per-code sign that the script reports, even after the tool is switched off.

## Results

The reader held up on standard-library and Flask 3.1.3 services, on Python 3.12, 3.13 and 3.14, on arm64 Linux.

- Every handler was graded correctly, including blueprint, decorated, class-based and error handlers.
- Under a pre-fork server with three workers, all 336 readings were correct.
- Across 6,076 readings with the original research prototype, no function that hadn’t run was reported as having run.
- With five profilers and tracers switched on and off, no function that ran was reported as never run.
- A helper reached only by one crafted request, through the same path and status as hundreds of ordinary requests, read "once" while its sibling read "repeatedly". An access log cannot tell those two apart.

## Limitations

- The state covers one process since it started. A restart or a recycled worker erases it without any sign, and each worker of a pre-fork server has to be read separately.
- "Never" has known false cases. Reloaded code reads "never", and so does a 3.12 function that returns early. A profiler can also reset a counter, and the script flags when one has.
- It shows that code ran. It does not show when, for whom or with what input, and an intruder running code inside the process can reset the marks.
- These are lab results. I have not tested x86-64, containers or production servers such as gunicorn, and a read of a large service takes tens of seconds and slows it while it runs.

The full list of tested environments, costs and requirements is in `TESTED.md` in the repository.

## How to use the answer

Read the process before anyone restarts the service. "Once" and "repeatedly" are strong evidence that the code ran in that process. "Never" is a lead. Confirm it another way before relying on it.

## Downloads and source

- [Python script (`didrun.py`)](https://github.com/subversive01/security-research-notes-public/blob/main/python-did-it-run/didrun.py)
- [Tested environments and results](https://github.com/subversive01/security-research-notes-public/blob/main/python-did-it-run/TESTED.md)
- [GitHub repository](https://github.com/subversive01/security-research-notes-public)

## Prior work

Reading a runtime's own optimization state to tell which code ran is a published technique with a long public history.

- **2013.** Häubl, Wimmer and Mössenböck derived exact code coverage from the profiling data a Java just-in-time compiler records, with no added instrumentation. [\[1\]](#reference-1)
- **2017.** The V8 JavaScript engine shipped best-effort coverage, which reports which functions ran from counters the engine keeps anyway. [\[2\]](#reference-2)
- **2021.** PEP 659 specified CPython's adaptive instructions and their counters in public. [\[3\]](#reference-3)
- **2022.** Brandt Bucher published `specialist`, which displays that CPython state from inside a program. Manna, Case, Ali-Gombe and Richard noted in a forensic paper on .NET that a method the runtime has compiled is one that was executed. [\[4\]](#reference-4) [\[5\]](#reference-5)
- **2024.** Kodem Security described the technique for several runtimes, including Python, in a patent application (WO 2025/219998 A1), naming per-version fields up to Python 3.11 and the cache entries of the adaptive bytecode. [\[6\]](#reference-6)
- **2025.** Ali, Case and Ahmed showed how to walk a Python process's memory to its functions. [\[7\]](#reference-7)

## References

1. <a id="reference-1"></a> C. Häubl, C. Wimmer, H. Mössenböck. "Deriving code coverage information from profiling data recorded for a trace-based just-in-time compiler." 2013. <https://doi.org/10.1145/2500828.2500829>
2. <a id="reference-2"></a> V8 project. "JavaScript code coverage", 13 December 2017 (best-effort coverage). <https://v8.dev/blog/javascript-code-coverage>
3. <a id="reference-3"></a> M. Shannon. PEP 659, "Specializing Adaptive Interpreter", 2021, sections Overview, Specialization and Ancillary data. <https://peps.python.org/pep-0659/>
4. <a id="reference-4"></a> B. Bucher. `specialist`, public since June 2022. <https://github.com/brandtbucher/specialist>
5. <a id="reference-5"></a> M. Manna, A. Case, A. Ali-Gombe, G. G. Richard III. "Memory analysis of .NET and .Net Core applications." Forensic Science International: Digital Investigation 42 (2022) 301404. <https://doi.org/10.1016/j.fsidi.2022.301404>
6. <a id="reference-6"></a> Kodem Security Ltd. WO 2025/219998 A1, "Identifying Active Code Sections via Memory Forensics". International application, priority 2024-04-15, published 2025-10-23.
7. <a id="reference-7"></a> H. Ali, A. Case, I. Ahmed. "Memory Analysis of the Python Runtime Environment." Forensic Science International: Digital Investigation 53 (2025) 301920.
