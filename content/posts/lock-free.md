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
  Value Lookup(const Key& key) {
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

### The first lock-free version

- Reads does not need lock.
- Store the `map_` as a pointer.
- Updates make a copy of the original map and use `CAS` to replace it.

```C++
template<class Key, class Value>
class WRRMMap {
  Map<Key, Value> *map_;

public:
  Value Lookup(const Key& key) {
    return *map_[key];
  }

  void Update(const Key& key, const Value& value) {
    Map<Key, Value>* new_map = nullptr;
    do {
      Map<Key, Value>* old_map = map_;
      if(new_map) delete new_map;
      new_map = new Map<Key, Value>(old_map);
      new_map.insert(key, value);
    } while (!CAS(map_, old_map, new_map));

    // map_ is not deleted because it is possibly accessed by some thread via lookup
  }
}
```

This map is globally wait-free, but the `Update` of a single thread is not wait-free. However, C++ does not have GC and the `map_` cannot be deleted before `Update` returns. **Deterministic memory freeing is quite a fundamental problem in lock-free data structures**.

### Try with reference-counting

```C++
template <class Key, class Value>
  class WRRMMap {
    using Data = std::pair<Map<Key, Value>*, unsigned>;
    Data* data_;
  ...
};
```

Then `Lookup` can increments `data->second` and decrements it after searching. If the rc hits 0, delete it. However, it is still not thread-safe.

But the rc of the old `map_` will go to zero at some time, because new lookups will use the new map. So one solution is to use a queue to store old `map_`s and let a thread to check rc and delete them in loop. However, if a lookup thread is delayed a lot so that the scavenger cannot delete that map, so it is not theoretically safe.

Another [solution](https://dl.acm.org/doi/proceedings/10.1145/383962) uses DCAS. DCAS is kind of a double-CAS:
```C++
template <class T1, class T2>
bool DCAS(T1* p1, T2* p2,
          T1 e1, T2 e2,
          T1 v1, T2 v2) {
  if (*p1 == e1 && *p2 == e2) {
    *p1 = v1;
    *p2 = v2;
    return true;
  }
  return false;
}
```

The memories pointed by `p1` and `p2` will be replaced by `v1` and `v2` **if and only if** `*p1 == e1 && *p2 == e2`.

### Next optimization

CAS is still used, but a version supporting more than a pointer-length.

```C++
template <class Key, class Value>
class WRRMMap {
  using Data = std::pair<Map<Key, Value>*, unsigned>;
  Data data_;
public:
  Value Lookup(const Key& key) {
    Data old;
    Data fresh;
    do {
      old = data_;
      fresh = old;
      ++fresh.second;
    } while(!CAS(&data, old, fresh));

    Value temp = (*fresh.first)[k];
    do {
      old = data_;
      fresh = old;
      --fresh.second;
    } while(!CAS(&data_, old, fresh));
    return temp;
  }

  void Update(const Key& key, const Value& value) {
    Data old;
    Data fresh;
    old.second = 1;
    fresh.first = nullptr;
    fresh.second = 1;
    Map<Key, Value>* last = nullptr;

    do {
      old.first = data_.first;
      if(last != old.first) {
        if(fresh.first)
          delete fresh.first;
        fresh.first = new Map<Key, Value>(*old.first);
        fresh.first->insert(key, value);
        last = old.first;
      }
    } while(!CAS(&data_, old, fresh));

    // delete it confidently
    delete old.first;
  }
}
```

For `Lookup` method, if there is no `Update`s, 2 CAS usage can implement the atomic increment and decrement of the reference count. If there is an `Update` running, the `data.first` will not be modified until all other `Lookup`s related to it has returned (thanks to the `old.second = 1` in `Update`). `last` is used to avoid rebuilding the map if there is only rc modified. So it is a solution which lets `Update` waits for all `Lookup`s finishing before it is going to replace the map.

However, if the `Lookup`'s rate is very high, the `Update` will be possibly starved because the rc will never decrement to one. So it is actually a WRRMBNTM (Write-Rarely-Read-Many-ButNot-Too-Many) map.