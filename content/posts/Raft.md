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

