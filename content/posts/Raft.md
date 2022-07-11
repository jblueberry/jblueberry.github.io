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

Raft 是简化版的、工程化的 Paxos，分成了 Leader election、Log replication 和 Safety三个相对独立的模块。

[Extended Raft paper](https://pdos.csail.mit.edu/6.824/papers/raft-extended.pdf) 详细阐明了 Raft 的逻辑，6.824 的 2A、2B 和 2C 都可以用 paper 里的 Figure 2 来概括。

![Raft](/images/raft.png)

### Leader election

1. 每一个 server 都有内部的 term （从 1 开始）和投票状态 `votedFor`。term 在 Raft 中是一个非常特殊的状态变量，对于某一个 server 来说，只有在**在一定时间没有收到 leader 的 heartbeat** 后（包括出现 split votes 的情况下），才会引发 term 的自增，而 term 的自增总会伴随着一阵新的 election。
2. 每一个 candidate 向 peer 发送 RequestVote 后，如果得到了超过半数的 votes，便会转化为 leader。自此，该 server 会尝试着维持现在的 term，并作为 leader 周期性 heartbeat followers。
3. 当 follower 收到某个 leader 的 heartbeat 后，如果该 leader 的 term 比自己的 term 小（这意味着该 leader 不应该再是 leader，因为有一个 server 已经自增 term 并尝试成为新的 leader），此时需要将该信息 response 给该 leader，让其退化为 follower。**这里的该 leader 的真实状态不一定真的是 leader，因为可能存在网络延迟的问题，这个 heartbeat RPC 被推迟送达。**
4. 当某个 leader 的 heartbeat 信息中的 term 大于等于 follower 的 term 时，follower **无条件**认可该 leader 的信息。可能会觉得 follower 的行为过于被动，但是 follower 用 **term** 对 leader 的认可验证本身就保证了安全性。**对于每一个 follower 本身来说，只要 leader 的 term 至少比我的 term 大，那它的状态便是超前于我的，我便可以接受它的指令，即使它现在可能早就不是 leader 了。**
5. Raft 采用 random election timeouts 来避免 split votes。

### Log replication

