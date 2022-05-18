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

简言之，MapReduce 是一种 programming model，用于**处理**并**产生**大数据。

### Map 和 Reduce

整个计算过程需要的输入是一个 KV 集合，输出也是一个 KV 集合。暴露给用户的两个 interface 是 Map 和 Reduce。

- Map 接收一个 KV 作为输入，输出一个 KV 集合，集合被称为 intermediate KV pairs ；
- MapReduce library 从 intermediate 数据中将相同的 key 的 values 整合成一个集合后传递给 Reduce ；
- Reduce 从 intermediate KV paris 中接收某个特定的 key 和这个 key 对应的一个 value 集合，将其处理之后输出一个新的 value 集合。

类似于这样：
```
map: <k1,v1> -> list(<k2,v2>)
reduce: <k2,list(v2)> -> list(v2)
```
其中，Reduce 的输出域和 intermediate 数据的域是相同的，和 Map 的输入域可以不同。

### Google 的 MapReduce Implementation

不同的 environment 对应于不同的 implementation ，谷歌使用的计算 environment 为：

1. 机器大多是 x86 架构，跑 Linux ，内存 2-4 GB；
2. 商用网络，通常是 100 Mb/s 或者 1Gb/s；
3. 一个集群有上百或者上千个机器，出故障很正常；
4. 用便宜的 IDE 硬盘直接保存每个机器自己的数据，用内部开发的分布式文件系统来管理文件；
5. 用户向一个调度系统提交 jobs ，每个 job 是一个 task 集合，由调度系统来分配到集群中的可用机器上。

![image-20210810172027074](https://typora-img-tanwei.oss-cn-beijing.aliyuncs.com/img/image-20200602163943114.png)

论文里这段话没看懂：

> The Map invocations are distributed across multiple machines by automatically partitioning the input data USENIX Association OSDI ’04: 6th Symposium on Operating Systems Design and Implementation 139 into a set of M splits. The input splits can be processed in parallel by different machines. Reduce invocations are distributed by partitioning the intermediate key space into R pieces using a partitioning function (e.g., hash(key) mod R). The number of partitions (R) and the partitioning function are specified by the user.

但不影响，现在只知道原始的 raw data 被分割成了 M 个 splits ，可以由 M 个机器来并行 map ；并且也有 R 台机器可以并行执行 reduce 。具体的过程为：

1. MapReduce library 将输入数据分割为 M 个 splits ，每个 16 到 64 MB。然后在集群中 fork 出很多自己的复制（这里我理解为在不同的机器上都跑一个（或者多个）当前程序的 fork ）；
2. 其中有一个 copy 比较特殊，称之为 master，其他的 copies 需要被 master 分配任务，一共有 M 个 map 任务和 R 个 reduce 任务，master 会挑没事做的 worker 来分配 map 或者 reduce 任务；
3. 如果一个 worker 被分配了一个 map 任务 ，那它会读取特定的那个 split ，从数据中提取出 KV 对集合传输给用户定义的 `Map` 函数，`Map` 函数产生的 intermediate KV 对存在内存缓冲区中；
4. 内存缓冲区中的 intermediate 数据会被周期性写到磁盘上（map worker 自己的磁盘）并被分割为 R 个区域。这些缓冲数据在磁盘上的位置会被传递到 master ，master 需要把这些区域转发给 reduce workers ；
5. 当一个 reduce worker 被告知了缓冲数据的位置，它会调用 RPC 从特定的 map worker 那里读到这些数据。当所有的 intermediate data 都被读完后（这里其实留下了一个疑点，如何判断被读完了？），reduce worker 用 key 将这些数据排序，这样相同 key 的数据会被分到一起；
6. 对于被排序好的 intermediate data，reduce worker 遍历地将 `<k2, list(v2)>` 传到用户实现的 `Reduce` 函数（因为已经排序好了），并把输出 append 到该 reduce partition （一共有 R 个）的输出文件中；
7. 当所有的 map 和 reduce 任务都被完成后，master 唤醒用户程序，执行流回到用户代码中。

### MapReduce 建立倒排索引的例子

> 倒排索引：记录每个词条出现在哪些文档，以及文档中的位置。

摘录一下 MapReduce 应用于倒排索引的算法：

> Inverted Index: The map function parses each document, and emits a sequence of hword, document IDi pairs. The reduce function accepts all pairs for a given word, sorts the corresponding document IDs and emits a hword, list(document ID)i pair. The set of all output pairs forms a simple inverted index. It is easy to augment this computation to keep track of word positions.

假如说有三条词条：有 id 和 内容

| id   | Content            |
| ---- | ------------------ |
| 1    | Jay eats food.     |
| 2    | food & music       |
| 3    | Jay attends party. |

1. 首先将 raw data 进行 split，分成三条内容：

   | id   | Content        |
   | ---- | -------------- |
   | 1    | Jay eats food. |

   | id   | Content      |
   | ---- | ------------ |
   | 2    | food & music |

   | id   | Content            |
   | ---- | ------------------ |
   | 3    | Jay attends party. |

2. 分配出三个 map worker ，对三个 split 处理，将其转换为：

   1. Map worker 1: 

      | Word | document ID |
      | ---- | ----------- |
      | Jay  | 1           |
      | eat  | 1           |
      | food | 1           |

   2. Map worker 2: 

      | Word  | document ID |
      | ----- | ----------- |
      | food  | 2           |
      | music | 2           |

   3. Map worker 3: 

      | Word   | document ID |
      | ------ | ----------- |
      | Jay    | 3           |
      | attend | 3           |
      | party  | 3           |

3. 假设分配两个 reduce worker ，那需要一个算法对 map worker 产生的 KV 对分类。这里有无数种方法，比如说用 key 的长度为奇数还是偶数来分类。每个 map worker 都有 disk A 和 disk B 来存储这两类 KV 对。

   1. 对于 Map worker 1:

      - Disk A

        | Word | document ID |
        | ---- | ----------- |
        | Jay  | 1           |
        | eat  | 1           |

      - Disk B

        | Word | document ID |
        | ---- | ----------- |
        | food | 1           |

   2. 对于 Map worker 2:

      - Disk A

        | Word  | document ID |
        | ----- | ----------- |
        | music | 2           |

      - Disk B

        | Word | document ID |
        | ---- | ----------- |
        | food | 2           |

   3. 对于 Map worker 3:

      - Disk A

        | Word  | document ID |
        | ----- | ----------- |
        | Jay   | 3           |
        | party | 3           |

      - Disk B

        | Word   | document ID |
        | ------ | ----------- |
        | attend | 3           |

4. 一旦有一个 Map worker 的某个 disk 被写完毕了时候，它会告诉 master，然后 master 会调用 Reduce worker 来做 Reduce 的工作；

   1. 对于 Reduce worker 1:

      得到的数据最终为：

      | Word  | document ID |
      | ----- | ----------- |
      | Jay   | 1           |
      | eat   | 1           |
      | music | 2           |
      | Jay   | 3           |
      | party | 3           |

   2. 对于 Reduce worker 2:

      得到的数据最终为：

      | Word   | document ID |
      | ------ | ----------- |
      | food   | 1           |
      | food   | 2           |
      | attend | 3           |

5. 经过排序（有很多方法排序）然后整理成 `<key, list(value)>` ：

   1. 对于 Reduce worker 1:
   
      | Word  | document ID |
      | ----- | ----------- |
      | Jay   | 1, 3        |
      | eat   | 1           |
      | music | 2           |
      | party | 3           |
   
   2. 对于 Reduce worker 2:
   
      | Word   | document ID |
      | ------ | ----------- |
      | food   | 1, 2        |
      | attend | 3           |
   
6. 最后整合：

   | Word   | document ID |
   | ------ | ----------- |
   | Jay    | 1, 3        |
   | eat    | 1           |
   | music  | 2           |
   | party  | 3           |
   | food   | 1, 2        |
   | attend | 3           |

一个典型的分布式的倒排索引的过程就是这样。

## 6.824 lab1 的坑


首先测试脚本有一个 bug ，在 `src/main/test-mr.sh` 的 202 行：

```bash
wait -n
```

把 `-n` 去掉，不然在 macOS 下这是一条非法的脚本指令。会导致脚本继续往下走，直接运行后面的 `sort` （但此时需要 `sort` 的文件还没生成）最后导致 FAIL 。可能是 macOS 的问题，也可能是 zsh 的问题，反正修改之后我就顺利的 All PASS 了。

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
