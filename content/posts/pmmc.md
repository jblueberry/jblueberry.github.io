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

## Paxos roles

Paxos Made Moderately Complex is still a Paxos protocol, but it attempts to reach consensus on a sequence of consecutive values. Therefore, it also has the two phases of the basic Paxos protocol, phase 1 and phase 2.

In my opinion, phase 1 is the process where a proposer competes to obtain the right to speak, while phase 2 is the process where it starts to give orders after obtaining the right to speak.

Therefore, the process of phase 1 can be seen as a leader trying to become an active leader, while the behavior of phase 2 is the active leader attempting to synchronize with other passive leaders after receiving a client request. The behavior pattern here is different from that in the PMMC paper. In the paper, after receiving a client request, replicas broadcast it to the leaders, and the leaders, after receiving the proposal from the replicas, compete to synchronize it with the acceptors. In the unified three-role model, each replica is also a leader, so whenever it receives any request, it directly hands it over to the leader for processing (instead of broadcasting it). The leader is responsible for achieving consensus on the request with others. Furthermore, passive leaders can ignore client requests and passively wait for synchronization from the active leader.

The behavior of the acceptor is very similar to that in the paper. Interestingly, the acceptor and replica will share a slot set (actually, a key-value map with the key being the slot number). In the PMMC paper, the acceptor has three sets: requests, proposals, and decisions. By directly handing the client request over to itself (the leader) for processing, we eliminate the dependency on the requests set.

Based on the implementation in lab1, the at-most-once semantics were utilized, which means that an active leader can blindly put a proposal into a slot and start syncing without worrying about whether the command has already existed. In addition, in the original PMMC paper, both acceptors and leaders maintain a proposals set, but in the current design pattern, acceptors also act as leaders and thus do not need to maintain a separate proposals set. Instead, the proposals set, decisions set, and acceptor's accepted set are combined into a slots map, as mentioned earlier.

## Stable leader election

The process of election itself is to go through the phase 1 process of Paxos. Raft also uses a similar approach, but it does not specifically wrap term and server index into a ballot. The key to a successful election lies in two points: 1) obtaining at least a majority of the votes as quickly as possible (determined by the phase 1 responses); 2) sending an active leader heartbeat to all other leaders as quickly as possible before others increment their ballot and issue a new election. Therefore, choosing the right interval for sending heartbeats and starting a new election is crucial to prevent a livelock situation where every server keeps self-nominating itself as the active leader but never achieves stability.

## Slot map

The slot map is an interesting data structure used to store key-value pairs of slot numbers and their corresponding slots. Each slot logically consists of two components: the command itself (which includes its source, i.e. the client address), and the state of the slot.

The state of a slot can be one of three: created, accepted, or chosen. As I mentioned earlier, only the active leader will handle client requests. Therefore, when the active leader creates a slot for a particular request, the initial state of that slot should be "created".

When the active leader tries to propagate the slot information to acceptors (i.e., Paxos phase 2 requests), the acceptor will check if the request is indeed from the active leader it has accepted. If so, the acceptor will overwrite the entry in its slot map for that slot number with the command and mark it as "accepted." Note that if the acceptor's local slot map does not have an entry for that slot number, it will simply create one. If there is already an entry, but the command is different from the content of the phase 2 request, the acceptor needs to decide whether to overwrite it. Here, we see that the slot's content is not enough because the acceptor will not blindly accept phase 2 requests (e.g., a late phase 2 request). Therefore, the slot should also record the latest relevant ballot for that slot. In the previous situation, acceptors will check the latest related ballot in the slot, and if the ballot of the phase 2 request is newer, it will overwrite it. And by the way, since the leader is also an acceptor, it does not need to send a phase 2 request to itself. Instead, it can use a simple local method call to replace the RPC request.

After discussing the behavior of acceptors, let's talk about the behavior of replicas. Replicas still accept decisions, which need to contain at least the slot number and slot content. In theory, replicas will blindly accept decisions because Paxos' safety guarantees that the same slot number cannot have two different contents selected, and therefore, there will not be two different decisions for the same slot number. Hence, when a replica receives a decision, it simply needs to set the corresponding slot's status to "chosen".

## Execution

Next, let's talk about how to execute slots with a slot map.