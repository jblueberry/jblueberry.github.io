---
title: "Paxos Made Moderately Complex Made Simple"
date: 2023-03-09T21:25:11+08:00
draft: true
---

My Design for [PMMC](https://paxos.systems/)

<!--more-->

Due to the fact that in the PMMC paper, the three roles (replica, leader and acceptor) are treated as three distinct processes, whereas actual implementation requires a Paxos server to behave with all three roles simultaneously, there is a considerable gap between the paper and the implementation.

Furthermore, the leader's phase 1 and phase 2 require the creation of sub-processes called "scout" and "commander" respectively, which makes the conversion from this design pattern to a single-threaded design quite challenging.

Additionally, it is necessary to implement a stable active leader and a garbage collection mechanism similar to Raft to ensure the liveness and availability of the system.

## Paxos Roles

Paxos Made Moderately Complex is still a Paxos protocol, but it attempts to reach consensus on a sequence of consecutive values. Therefore, it also has the two phases of the basic Paxos protocol, phase 1 and phase 2.

In my opinion, phase 1 is the process where a proposer competes to obtain the right to speak, while phase 2 is the process where it starts to give orders after obtaining the right to speak.

Therefore, the process of phase 1 can be seen as a leader trying to become an active leader, while the behavior of phase 2 is the active leader attempting to synchronize with other passive leaders after receiving a client request. The behavior pattern here is different from that in the PMMC paper. In the paper, after receiving a client request, replicas broadcast it to the leaders, and the leaders, after receiving the proposal from the replicas, compete to synchronize it with the acceptors. In the unified three-role model, each replica is also a leader, so whenever it receives any request, it directly hands it over to the leader for processing (instead of broadcasting it). The leader is responsible for achieving consensus on the request with others. Furthermore, passive leaders can ignore client requests and passively wait for synchronization from the active leader.

The behavior of the acceptor is very similar to that in the paper. Interestingly, the acceptor and replica will share a slot set (actually, a key-value map with the key being the slot number). In the PMMC paper, the acceptor has three sets: requests, proposals, and decisions. By directly handing the client request over to itself (the leader) for processing, we eliminate the dependency on the requests set.