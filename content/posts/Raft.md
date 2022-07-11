+++
author = "Junhui Zhu"
title = "Raft"
date = "2022-06-10"
tags = [
    "Go",
    "Distributed Systems",
    "Raft"
]
+++

6.824 lab2 极限折磨。

<!--more-->

## Raft

Raft 是简化版的、工程化的 Paxos，分成了 Leader election、Log replication 和 Safety 三个相对独立的模块。

[Extended Raft paper](https://pdos.csail.mit.edu/6.824/papers/raft-extended.pdf) 详细阐明了 Raft 的逻辑，6.824 的 2A、2B 和 2C 都可以用 paper 里的 Figure 2 来概括。

![Raft](/images/raft.png)

### Leader election

1. 每一个 server 都有内部的 `term` （从 1 开始）和投票状态 `votedFor`。`term` 在 Raft 中是一个非常特殊的状态变量，对于某一个 server 来说，只有在**在一定时间没有收到 leader 的 heartbeat** 后（包括出现 split votes 的情况下），才会引发 `term` 的自增，而 `term` 的自增总会伴随着一阵新的 election。
2. 每一个 candidate 向 peer 发送 `RequestVote` 后，如果得到了超过半数的 votes，便会转化为 leader。自此，该 server 会尝试着维持现在的 `term`，并作为 leader 周期性 heartbeat followers。
3. 当 follower 收到某个 leader 的 heartbeat 后，如果（在这个 RPC 中）该 leader 的 `term` 比自己的 `term` 小（这意味着该 leader 不应该再是 leader，因为一定存在一个 server 已经自增 `term` 并尝试成为新的 leader），此时需要将该信息 response 给该 leader，让其退化为 follower。**这里的该 leader 的真实状态不一定真的是 leader，因为可能存在网络延迟的问题，这个 heartbeat RPC 被推迟送达。**
4. 当某个 leader 的 heartbeat 信息中的 `term` 大于等于 follower 的 `term` 时，follower **无条件**认可该 leader 的信息。可能会觉得 follower 的行为过于被动，但是 follower 用 **`term`** 对 leader 的认可验证本身就保证了安全性。**对于每一个 follower 本身来说，只要 leader 的 `term` 至少比我的 `term` 大，那它的状态便是超前于我的，我便可以接受它的指令，即使它现在可能早就不是 leader 了。**
5. Raft 采用 random election timeouts 来避免 split votes。

### Log replication

1. 每一个 leader 需要维护 peers 的 `matchIndex` 和 `nextIndex` 状态。
   1. 每一个 heartbeat RPC 里携带了需要给该 follower 同步的 log entries，在 [Extended Raft paper](https://pdos.csail.mit.edu/6.824/papers/raft-extended.pdf) 里每个 RPC 只有一个或者零个（pure heartbeat），但是在 6.824 lab2C 里会优化这个机制，让每个 RPC 携带多个 entries，提高效率。**而对于每个 follower 来说，其 heartbeat RPC 里要放哪些 entries，取决于该 leader 为其维护的 `nextIndex`。**
   2. 当某个 heartbeat 携带了 entries 并得到了对方 follower 的肯定回复时，该 leader 便可以断定该 follower 已经同步了 heartbeat 中涵盖的 log 信息，也就是，完成了 replication，此时可以修改该 follower 的 `matchIndex` 和 `nextIndex`。
   3. 每一个 heartbeat RPC 都包含着发送该 RPC 的 leader 认为该 follower 当前所需要同步的 entry index。显然这并不是任何时候都成立的，因此，对于某个 follower，假如该 heartbeat 是合法的（term checked），但是 leader 搞错了 follower 实际需要的 entry index，follower 便会返回 `false`，让 leader 去修正其为该 follower 维护的 `nextIndex`，**直到被 follower 肯定回复**。
   4. 在某个 server 刚刚转化为 leader 时，初始化每个 follower 的 `matchIndex` 为 `0`，并初始化每个 follower 的 `matchIndex` 为 `nextLogIndex`。每一个 server 的 `nextLogIndex` 是该 server 下一个 potential log entry 的 index。
2. 每一个 server 都需要维护 `commitIndex` 和 `lastApplied`。`commitIndex` 表示：到 `commitIndex` 之前，所有的 log entry 都被该系统中的 majority 所认可，可以直接放心作用于状态机；`lastApplied` 表示当前真正已经被作用于状态机（这个动作称为 apply）的最后一个 entry 的 index。
   1. 对于 leader 来说，由于外部（上层应用的）entry 只能被 leader 所接受，而也只有 leader 会尝试将 entry 同步给 followers，因此 leader 会在某些 entry 被大部分机器所承认时，**主动**修改 `commitIndex`（在这里，这些 entry 被成为**被 commit** 了。），并将其作为 heartbeat RPC 的一部分信息同步给 followers；
   2. 对于 follower 来说，所有对 `commitIndex` 的修改都源自于 leader 的 heartbeat。在一般情况下，当 leader 的 `commitIndex` 大于自身的时，便同步成 leader 的。
   3. 每一个 server 都需要检查自身的 `commitIndex` 和 `lastApplied`，当前者大于后者时，便意味着有事情做了，可以把一些 entry 给 apply 掉了。

### Safety

Leader election 和 log replication 显然是需要某些约束才能保证 Raft 的正确性的。[Extended Raft paper](https://pdos.csail.mit.edu/6.824/papers/raft-extended.pdf) 中笼统概括了一些 Safety properties，但是在写 lab 的时候，其实有更多的细节需要去考虑到。

1. 首先，当所有的 RPC 中包含的 term 小于 server 自身的 term 时，忽略它，或者是返回 `false`（如果有）。
2. 当一个 candidate 向其他 server requests votes 时，对于某一个特定的 server，只有该 candidate 的 log 与它自己的 log 相比 **least as up-to-date** 时，才会给予 vote。Log 之间的 up-to-date 是一个非常微妙的比较关系，参考 paper 第 8 页。
3. Leader 绝对不可以 commit 不是当前 term 的 entry，即使它确实已经被集群 majority 所共识。该性质解决了 paper 中 Figure 8 阐述的问题，简单来说便是，如果 leader 可以随意 commit 任意被集群多数所共识的 entry，会产生某个 index 的 entry 被 apply 多次的灾难现象，而这是绝对不允许的。[这篇知乎文章](https://zhuanlan.zhihu.com/p/369989974)详细解释了 Figure 8，并使用了一个 no-op 来解决这个问题，我最后的代码实现并没有采用额外的 no-op 来做这件事，而是**在 leader 尝试进行 `commitIndex` 前，进行额外的 `term` 对比**，假如该 leader 只能找到不是当前 `term` 的、但是被多数机器所认可的 entry，便**不修改 `commitIndex`**。

## 6.824 lab2

即使看懂了 paper 里 election、replication 和 safety 的三块阐述，编写 lab2 时还是会出现各种各样的奇怪 bug，我最后的版本在连续跑了 800 次 test 后没有报错，提一些细节处理。

1. 控制锁的粒度，就像 6.824 助教说的，千万不要用很多小锁来保护各种各样的 shared data，锁的粒度太小，跟没锁一样。
1. `votedFor` 这个变量需要额外小心