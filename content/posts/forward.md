+++
author = "Junhui Zhu"
title = "为什么 std::forward 有两个 overloads"
date = "2022-09-06"
tags = [
    "C++",
]
+++

翻译自 C++ 委员会 Howard E. Hinnant 的 [paper](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2009/n2951.html).

<!--more-->

`forward` 并不只是为了以下使用场景而生的：

```C++
template <class T>
void f(T&& x)
{
    // x is an lvalue here.  If the actual argument to f was an
    // rvalue, pass static_cast<T&&>(x) to g; otherwise, pass x.
    g(forward<T>(x));
}
```

如果只要满足以上场景，那仅仅用 `static_cast<T&&>(x)` 就够了。

作者给出了 6 个 `forward` 的实现，并用 A to F 的使用场景测试，0 号实现就是 `static_cast<T&&>(x)` ，5 号实现是现在真正的 `forward`。
|   | A  | B | C |D |E|F |score|
|---|---|---|---|---|---|---|---|
0	| pass| 	 pass |	 rfail 	| pass| 	 pass 	 |rfail 	|67%|
1	| pass 	| cfail 	| rfail |	 pass 	| pass 	| rfail |	50%|
2	| pass 	| cfail |	 pass 	 |cfail |	 cfail 	| pass| 	50%|
3|	 pass 	| pass 	| pass 	| pass |	 pass |	 rfail |	83%|
4	| pass 	| pass 	| pass |	 pass 	| cfail |	 pass |	83%|
5	| pass 	 |pass 	| pass |	 pass 	| pass| 	 pass |	100%|

## 6 种实现

烂尾了。