+++
author = "Junhui Zhu"
title = "Lock-free 数据结构研究"
date = "2023-01-16"
tags = [
    "C++",
    "Rust"
]
+++

精读文章 http://erdani.org/publications/cuj-2004-12.pdf and https://erdani.org/publications/cuj-2004-10.pdf

<!--more-->

## Lock free still needs atomic operations

There is a minimal set of atomic primitives that would allow implementing any lock-free algorithm. There is a paper "Wait-Free Synchronization" discussing about it. There are some interesting summaries:

- `test-and-set`, `swap`, `fetch-and-add`, `atomic queues` are insufficient for properly synchronizing more than **two** threads.
- Some simple constructs are enough for lock-free algorithm for **any** number of threads.

The simplest primitive is `compare-and-swap`:

```C++
template <class T>
bool CAS(T* addr, T exp, T val) {
  if (*addr == exp) {
    *addr = val;
    return true;
  }
    return false;
}
```

CAS has three parameters: `addr`, `exp` and `val`. It compares the value pointed by `addr` with `exp`, if they are equal, sets the memory pointed by `addr` to a new value and returns `true`, otherwise returns `false` and does nothing.