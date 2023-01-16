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

## Wait-free and lock-free

- Wait-free: a procedure that can complete in a finite number of steps.
- Lock-free: a procedure guarantees progress of at least one of the threads executing the procedure. **在每一步，至少有一个 thread 在前进**。

Lock-based programs cannot provide wait-free and lock-free guarantees (deadlock or a thread is sleeping while holding the lock). The metaphor of livelock is very interesting in the paper: Two dudes in the hallway trying to go past one another but end up doing that social dance of swinging left and right in synchronicity.

Some advantages of wait-free and lock-free algs:
1. A thread forcefully killed will not delay others.
2. Lock-free routines can freely interleave execution, not like `malloc` cannot be called in signal handlers (because there is a heap lock).
3. Immune to priority inversion.

## A Lock-free Map

WRRM: Write Rarely Read Many, the scenes including `factories`, `observer design pattern`, etc.

`assoc_vector` is used to implement it with trading update speed for lookup seed. Whatever is used, the interface is a `Map<Key, Value>`. And no `iteration` provided.

### A lockful implementation

```C++
template<class Key, class Value>
class WRRMMap {
  Mutex mutex_;
  Map<Key, Value> map_;

public:
  V lookup(const Key& key) {
    Lock lock(mutex_);
    return map_[key];
  }

  void Update(const Key& key, const Value& value) {
    Lock lock(mutex_);
    map_.insert(key, value);
  }
}
```

It is really a bad implmentation because parallel lookups does not need locks. (As long as there is no updates currently)
