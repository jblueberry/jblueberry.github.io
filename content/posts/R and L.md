+++
author = "Junhui Zhu"
title = "左值、右值和类型推导"
date = "2022-08-25"
tags = [
    "C++",
]
+++

就是说，在尝试理解 C++ 语法层面的概念时，最好不要用理解 C 的那一套思路。也就是说，不要试图从高级语言的语法去揣测底层内存的行为。不然，看到“右值引用能够延长一个右值的生命周期而本身该引用是一个左值”时，可能会发疯。

<!--more-->

## 左值和右值

能**寻址**的变量就是左值，不能的就是右值。

### 左值引用和右值引用

左值引用只可以引用左值,右值引用只可以引用右值。恩，废话。

```C++
int x = 1;
int & x_lref = x; // 左值引用引用左值
// int & x_lref_wrong = 1; 报错，左值引用只可以引用左值

int && x_rref = 1; // 右值引用可以引用右值
// int && x_rref_wrong = x; 报错，右值引用只可以引用右值
```

同时，类别（types）和值类别（value categories，也就是左值或右值）是两个事情。

### `const &` 可以指向右值

```C++
const int &x = 5; // 可以过编译
```

具体的原因是为了能少重载一次，不然对于某个函数 `void f(T const &t)`，还需要对右值参数进行一次重载，换句话说，

```C++
class T;
T get_T();
void f(T const &t);

T t{};
f(t); // OK
f(get_T()) // Also OK 因为 const & 接受右值
```
### `std::move` 的作用

`std::move` 就是把一个值强制转换成右值（右值也可以），本质上和 `static_cast<T &&>()` 是一样的。

但是单单的 `std::move` 并不会改变这个值，也不会移动这个对象，以下代码会输出两个 `1`。

```c++
int x = 1;

int && x_rref = std::move(x);
// 等同于：
// int && x_rref = static_cast<int &&>(x);

std::cout << x << x_rref;
```

有名字的变量都是左值，所以 `x_rref` 也是左值。**`move`的作用在于把右值提升成了左值，延长了生命周期。**`x_rref` 和 `x` 仍然有着引用的关系，如：

```C++
void f(int &&);

int x = 1;
int && x_rref = std::move(x);
x = 2;
std::cout << x_rref << std::endl; // output: 2

f(x_rref); // 编译错误
f(std::move(x)); // 可以编译
```

### 右值引用的作用

根据以上，右值引用很奇怪，其作用在于移动语义，一个在传统的对象拷贝情境中，如果被拷贝对象在拷贝完成后不再需要，就可以简化为**移动**。比如说，`std::unique_ptr` 是一个极端的例子，该指针所指向的对象必须只能被一个智能指针所指向，所以拷贝构造函数是被禁用的。

```c++
// Move constructors.

/// Move constructor.
unique_ptr(unique_ptr&& __u) noexcept
: _M_t(__u.release(), std::forward<deleter_type>(__u.get_deleter())) { }
```

然而，`move` 出的对象是一个左值，但类型是右值引用而不能被作为 argument 传入类似于 `f(T &&)` 这类函数，这件事本身依然非常鸡肋。但也没办法 :kissing: