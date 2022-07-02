+++
author = "Junhui Zhu"
title = "MapReduce with Go"
date = "2021-08-10"
tags = [
    "Go",
    "Distributed Systems"
]
+++

6.824 lab1 的 notes。

<!--more-->

## MapReduce

简言之，MapReduce 是一种 programming model。

### Map 和 Reduce

输入是一个 KV 集合，输出也是一个 KV 集合，用户可以自行实现 Map 和 Reduce。

- Map 接收一个 KV `<k1,v1>` 作为输入，输出一个 KV 集合 `list(<k2, v2>)`，集合被称为 intermediate KV pairs；
- 对 intermediate 中相同 key 的数据进行聚合，这一步称为 Shuffle；
- 将 Shuffle 好的数据传给 Reduce，每一个 `<k2, list(v2)>` 最终将映射到另一个集合 `<k2, v3>`。

```
map: <k1,v1> -> list(<k2,v2>)
shuffle: list(<k2, v2>) -> list(<k2, list(v2)>)
reduce: <k2,list(v2)> -> <k2, v3>
```

![mr](/images/mr.drawio.png)

1. 将输入数据分割为 M 个 splits；
2. 一共有 M 个 map 任务和 R 个 reduce 任务；
3. 如果一个 worker 被分配了一个 map 任务，那它会读取特定的那个 split ，从数据中提取出 KV 对集合传输给用户定义的 `Map` 函数，`Map` 函数产生的 intermediate KV 对存在内存缓冲区中；
4. 内存缓冲区中的 intermediate 数据会被周期性写到磁盘上并被分割为 R 个 intermediate；
5. 如果一个 worker 被分配了一个 map 任务，会通过 RPC 读取该任务对应的 intermediate data，并调用 `Reduce`；
6. master 负责指派、协调 map worker 和 reduce worker。

### Google 的 MapReduce Implementation

1. 机器大多是 x86 架构，跑 Linux ，内存 2-4 GB；
2. 商用网络，通常是 100 Mb/s 或者 1Gb/s；
3. 一个集群有上百或者上千个机器，出故障很正常；
4. 用便宜的 IDE 硬盘直接保存每个机器自己的数据，用内部开发的分布式文件系统来管理文件；
5. 用户向一个调度系统提交 jobs ，每个 job 是一个 task 集合，由调度系统来分配到集群中的可用机器上。

## 6.824 lab1

起初，我是想着 map 和 reduce 的 task 轨迹是完全并行的。换句话说，就是可以同时有 map task 和 reduce task 同时跑着，后来发现一没必要二让 master 的逻辑大大增加。于是简化为：

- master 将整个过程分为 mapPhase 和 reducePhase ，在 map 阶段还有 map 任务没完成之前，master 不会去分配 reduce 任务；
- 只用一把大锁锁住整个 master 对 task 的分配过程；
- worker 不用向 master 注册，只需要询问要任务就可以了；
- master 只需要根据当前的状态（map 阶段还是 reduce 阶段）回应 worker 的 request 就好，如果此时没有相应的任务了（所有任务都是完成或者进行阶段），就让 worker 等一等。

而比较麻烦的东西是 intermediate 文件的**原子操作**。举个例子，一个 reduce task 需要涉及到 `nMap` 个 intermediate 文件，而如果有多个 worker 同时在跑这个 reduce task ，这会产生一些并发问题，经过简化后是这样解决的：

1. 对于多个 worker 同时跑同一个 map task 时，首先对于 raw data 的读是不会产生竞争的，随意同时读；
2. 上一个情况中，每个 worker 都先创建一个**不会有命名冲突**的 tmp 文件，在完成创建之后再将其重命名为标准的中间文件名，这样就不会产生对同一个文件的 write race 了，而且即使发生了两次重命名，也不影响整个任务的正确执行，顶多有点浪费资源；
3. 同样的，多个 worker 同时跑同一个 reduce task 时，对于 intermediate 文件的并发读没有问题；
4. 产生最终的 `mr-out-X` 之前，也遵循 2 中说的策略，先写到永远不会冲突的 tmp 文件后重命名即可。

我用的是 `os.Getpid()` 作为临时文件的后缀名，这样不同的进程就不会产生冲突了。

值得优化的地方是，我完全没有用到 Golang 引以为豪的 channel ，而且我也不太明白这个到底有什么用。。。既然过了就开始看 Raft 了。
