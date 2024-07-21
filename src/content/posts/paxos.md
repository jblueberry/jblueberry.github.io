---
title: MultiPaxos Cheat Sheet
date: 2023-03-09T21:25:11+08:00
tags:
  - Paxos
  - Distributed Systems
---

My Design for [PMMC](https://paxos.systems/).

There is no implementation code, only macroscopic ideas, which are heuristic for [6.824](http://nil.csail.mit.edu/6.824/2022/) (of course you can implement MultiPaxos as Raft-alternative) or [CS5223](https://nusmods.com/courses/CS5223/distributed-systems).

这里没有实现源码，只有大致的思路。

<!--more-->

Due to the fact that in the PMMC paper, the three roles (replica, leader and acceptor) are treated as three distinct processes, whereas actual implementation requires a Paxos server to behave with all three roles simultaneously, there is a considerable gap between the paper and the implementation.

Furthermore, the leader's phase 1 and phase 2 require the creation of sub-processes called "scout" and "commander" respectively, which makes the conversion from this design pattern to a single-threaded design quite challenging.

Additionally, it is necessary to implement a stable active leader and a garbage collection mechanism similar to Raft to ensure the liveness and availability of the system.

## Paxos Roles

Paxos Made Moderately Complex is still a Paxos protocol, but it attempts to reach consensus on a sequence of consecutive values. Therefore, it also has the two phases of the basic Paxos protocol, phase 1 and phase 2.

In my opinion, phase 1 is the process where a proposer competes to obtain the right to speak, while phase 2 is the process where it starts to give orders after obtaining the right to speak.

Therefore, the process of phase 1 can be seen as a leader trying to become an active leader, while the behavior of phase 2 is the active leader attempting to synchronize with other passive leaders after receiving a client request. The behavior pattern here is different from that in the PMMC paper. In the paper, after receiving a client request, replicas broadcast it to the leaders, and the leaders, after receiving the proposal from the replicas, compete to synchronize it with the acceptors. In the unified three-role model, each replica is also a leader, so whenever it receives any request, it directly hands it over to the leader for processing (instead of broadcasting it). The leader is responsible for achieving consensus on the request with others. Furthermore, passive leaders can ignore client requests and passively wait for synchronization from the active leader.

The behavior of the acceptor is very similar to that in the paper. Interestingly, the acceptor and replica will share a slot set (actually, a key-value map with the key being the slot number). In the PMMC paper, the acceptor has three sets: requests, proposals, and decisions. By directly handing the client request over to itself (the leader) for processing, we eliminate the dependency on the requests set.

Based on the implementation in lab1, the at-most-once semantics were utilized, which means that an active leader can blindly put a proposal into a slot and start syncing without worrying about whether the command has already existed. In addition, in the original PMMC paper, both acceptors and leaders maintain a proposals set, but in the current design pattern, acceptors also act as leaders and thus do not need to maintain a separate proposals set. Instead, the proposals set, decisions set, and acceptor's accepted set are combined into a slots map, as mentioned earlier.

## Stable Leader Election

The process of election itself is to go through the phase 1 process of Paxos. Raft also uses a similar approach, but it does not specifically wrap term and server index into a ballot. The key to a successful election lies in two points: 1) obtaining at least a majority of the votes as quickly as possible (determined by the phase 1 responses); 2) sending an active leader heartbeat to all other leaders as quickly as possible before others increment their ballot and issue a new election. Therefore, choosing the right interval for sending heartbeats and starting a new election is crucial to prevent a livelock situation where every server keeps self-nominating itself as the active leader but never achieves stability.

## Slot Map

The slot map is an interesting data structure used to store key-value pairs of slot numbers and their corresponding slots. Each slot logically consists of two components: the command itself (which includes its source, i.e. the client address), and the state of the slot.

The state of a slot can be one of three: created, accepted, or chosen. As I mentioned earlier, only the active leader will handle client requests. Therefore, when the active leader creates a slot for a particular request, the initial state of that slot should be "created".

When the active leader tries to propagate the slot information to acceptors (i.e., Paxos phase 2 requests), the acceptor will check if the request is indeed from the active leader it has accepted. If so, the acceptor will overwrite the entry in its slot map for that slot number with the command and mark it as "accepted." Note that if the acceptor's local slot map does not have an entry for that slot number, it will simply create one. If there is already an entry, but the command is different from the content of the phase 2 request, the acceptor needs to decide whether to overwrite it. Here, we see that the slot's content is not enough because the acceptor will not blindly accept phase 2 requests (e.g., a late phase 2 request). Therefore, the slot should also record the latest relevant ballot for that slot. In the previous situation, acceptors will check the latest related ballot in the slot, and if the ballot of the phase 2 request is newer, it will overwrite it. And by the way, since the leader is also an acceptor, it does not need to send a phase 2 request to itself. Instead, it can use a simple local method call to replace the RPC request.

After discussing the behavior of acceptors, let's talk about the behavior of replicas. Replicas still accept decisions, which need to contain at least the slot number and slot content. In theory, replicas will blindly accept decisions because Paxos' safety guarantees that the same slot number cannot have two different contents selected, and therefore, there will not be two different decisions for the same slot number. Hence, when a replica receives a decision, it simply needs to set the corresponding slot's status to "chosen".

## Execution

Next, let's talk about how to execute slots with a slot map. We need to maintain two variables: slot in and slot out. Slot out represents the number of the next slot to be executed, and slot in represents the next available slot number to be added to the slot map.

Some places (moments) where we need to try to perform:

1. When a slot receives agreement from more than half of the nodes (through Paxos phase 2 process), the active leader marks it as chosen and tries to perform it;
2. When a passive leader receives a decision;
3. When a leader becomes an active leader.

It can be observed that each time a slot is marked as chosen, it will be attempted to perform, but why is it attempted to perform? This is because only the slot at slot out can be attempted to execute, and multi-paxos supports out-of-order commit. There is a high probability that the slot at slot out has not been committed, while some slots behind it have already been committed, so we have to wait. Therefore, the logic in perform needs to be looped to ensure that a series of continuous slots that have been committed are completed at once to ensure efficiency.

## Scout & Commander

In the PMMC paper, both of scout and commander are presented as sub-processes of the leader. But in a single-threaded implementation, they need to be redesigned.

Scout is relatively simple. Scout is like an agent of the leader, who sends phase 1 requests instead of the leader, and ultimately helps leader to compete to become the active leader. Therefore, logically speaking, a passive leader needs a scout after initiating an election, while an active leader no longer needs that scout. In addition, at any given time, each leader needs at most one scout working. For this pattern, the simplest solution is to have the leader hold a scout object, which is not null while the leader is campaigning and is set to null after the campaign ends (regardless of success). You can write many assert statements to periodically check this in various parts of the code.

For commander, it's not as straightforward as scout. In the PMMC paper, the lifecycle of each commander is tied to a slot, and its responsibility is to attempt to synchronize that slot to other acceptors through the Paxos phase 2 process. In a single-threaded implementation, to achieve the same thing, it is necessary to create additional information to indicate that a specific slot number is being synchronized. A simple pattern is to use an extra map.

In addition, in PMMC, phase 2 responses only carry information about the ballot number, because each commander, as a subprocess, has its own independent endpoint. Once it receives a response, it knows that the response is definitely related to the slot bound to its own lifecycle. However, in a single-threaded environment, we cannot determine which slot number a phase 2 response is targeting when there is only one ballot in the response. Therefore, it is necessary to add additional information in the phase 2 response to solve this problem.

## Decision Sending and Garbage Collection

Finally, let's briefly talk about the timing of sending decisions. The timing of decision sending can be implemented in various ways. First of all, due to the safety of the Paxos protocol, once a slot is set to the chosen state, it will not be discarded (think about the accepted values in the phase 1 reply). Therefore, it is only necessary to design a mechanism for the active leader to synchronize the decision with others at an appropriate time point that others do not know.

One option is to broadcast decisions after a commander (logically) collects enough phase 2 replies and sets the corresponding slot to chosen. However, this is not safe, because decisions can be lost in transmission, and you cannot guarantee that you don't need to broadcast them again after broadcasting them once. And once a commander has synchronized its responsible slot to the majority, its lifecycle should end.

So leaving the decision sending to the commander has a relatively large burden. A more clever approach is to include decision in the heartbeat message. When an active leader sends a heartbeat to a passive leader, it can attach the next decision that the passive leader needs in the heartbeat message. One may wonder how the active leader knows what decision the passive leader needs. Therefore, it is necessary to introduce a reply to the heartbeat. The passive leader needs to reply to the heartbeat and tell the active leader which slot number's decision it needs next. When the active leader knows this and the slot corresponding to that slot number is indeed chosen, it will attach it in the next heartbeat message.

Indeed, this mechanism also enables garbage collection. The active leader can collect information about the next slot number needed by each passive leader. In other words, all the slots before that slot number have been executed by that passive leader. By collecting this information, active leader can calculate which slots have been executed by everyone and safely remove them from the slot map. This information can also be communicated to passive leaders by some means. When a passive leader knows that certain slots have been removed from the slot map by the active leader, it can confidently remove them as well. This mechanism can be used to implement garbage collection.
