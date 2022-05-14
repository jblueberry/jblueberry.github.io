+++
author = "Junhui Zhu"
title = "重新学习 Modern Cpp"
date = "2022-05-14"
tags = [
    "C++",
]
+++

记录一些 Modern Cpp 的学习。

<!--more-->

## Type Deduction

### Template Type Deduction

将 Template Type Deduction 看做一个这样的函数模板：
```C++
template<typename T>
void f(ParamType param);
```
编译器就像一个黑箱，接受一个表达式 `expr` 并根据 `ParamType` 的形式，推导出 `T` 和 `param` 的实际类型。

#### ParamType 是一个引用或者指针时，
1. 忽略 `expr` 的引用；
2. 根据忽略引用后的类型和 `ParamType` 进行模式匹配。

```C++
template<typename T>
void f(T& param);

int x = 1;
f(x); // T 被推导为 int，param 被推导为 int &

const int cx = x;
f(cx); // T 被推导为 const int，param 被推导为 const int &

const int & rx = x;
f(rx) // T 被推导为 const int，param 被推导为 const int &
```

我自己的理解：将 `T&` 用 backwards 的方法展开：reference to T，这里的 T 和 expr 的类型进行模式匹配。
因此，当传递一个 const 对象给 `T&` 时，该对象在函数中也保持了 constness。

当 `ParamType` 是 `const T &` aka reference to const T 时，`x` 作为 `expr` 会让 `T` 被规约为 int，但是 `cx` 和 `rx` 也会让 `T` 被规约为 int，因为 const 特性已经在 `ParamType` 里了。
```C++
template<typename T>
void f(const T& param);

int x = 1;
f(x); // T 被推导为 int，param 被推导为 const int &

const int cx = x;
f(cx); // T 被推导为 int，param 被推导为 const int &

const int & rx = x;
f(rx) // T 被推导为 int，param 被推导为 const int &
```

这也是很自然的结果，因为在函数中制定 parameter 是 const 的目的便是避免对其修改。

同样，当 `ParamType` 是指针时，
```C++
template<typename T>
void f(T* param);

int x = 1;
const int *px = &x;

f(&x); // T 被推导为 int，param 被被推导为 int*
f(px); // T 被推导为 const int，param 被被推导为 const int*
```
加了 const 后：
```C++
template<typename T>
void f(const T* param);

int x = 1;
const int *px = &x;

f(&x); // T 被推导为 int，param 被被推导为 const int*
f(px); // T 被推导为 int，param 被被推导为 const int*
```

下面的代码是不能通过编译的：
```C++
template<typename T>
void f(T* const param);

const int x = 1;

f(&x); // 破坏了 x 的 constness
```

#### ParamType 是一个通用引用时，
```C++
template<typename T>
void f(T&& param);
```

这样的通用引用是可以接受左值 argument 的，当 argument 是右值时和上面是一样的。

当 argument 是左值时，`T` 和 `ParamType` 都会被推导为左值引用。

```C++
template<typename T>
void f(T&& param);

int x = 1；
const int cx = x;
const int & rx = cx;

f(x); // T 和 ParamType 都是 int &
f(cx); // T 和 ParamType 都是 const int &
f(rx); // T 和 ParamType 都是 const int &
f(1); // T 是 int，ParamType 是 int &&
```

#### ParamType 不是引用也不是指针时

这种情况下，总是会 copy 一份 argument，因此忽略 argument 自己的引用和 constness 或者 `volatile` 特性。

#### 数组或者函数 argument

对一个普通函数来说，如果 parameter 是一个数组类型，那其实就是一个指针类型。换言之，`f(int param[])` 和 `f(int *param)` 是一回事。

但是模板函数中的 `ParamType` 包含引用时，可以获取到数组的所有信息，也就是说 `T` 会被推导为一个数组类型而不是指针。

```C++
template<typename T>
void f(T& param);

int arr[] = {1, 2, 3};
f(arr);
// T 被推导为 int [3]
// param 被推导为 int (&)[3]

/**
 * 借助这个特性，可以写一个编译期就能运行的函数，获取数组的大小
 */
template<typename T, std::size_t N>
constexpr std::size_t arraySize(T (&)[N]) noexcept
{
    return N;
}

int arr1[] = {1, 2, 3};
int arr2[arraySize(arr1)];
std::cout << sizeof(arr2) << std::endl; // 输出是 12
```

当 argument 是一个函数时，行为和数组是一样的。
