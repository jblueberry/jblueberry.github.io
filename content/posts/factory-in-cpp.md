---
title: "Factory Implement in Cpp"
date: 2022-11-07T20:37:04+08:00
draft: true
---

- Using smart pointers.

<!--more-->

```c++
#include <iostream>
#include <vector>
#include <algorithm>
#include <queue>
#include <unordered_map>
#include <functional>
#include <memory>

using namespace std;

template <typename T>
class AutoRegister
{
public:
	struct AutoRegisterProxy
	{
		AutoRegisterProxy()
		{
			T::Register();
		}
	};
	static AutoRegisterProxy __proxy;
};

template <class T>
typename AutoRegister<T>::AutoRegisterProxy AutoRegister<T>::__proxy;

class Base {
	public:
	virtual void printName() = 0;
};

template<typename Result, typename Key = std::string, typename ...Args>
class FactoryRegistry
{
public:

	static shared_ptr<Result> Make(const Key& name, Args... args) {
		auto registry = GetStorage();
		auto it = registry->find(name);
		if(it == registry->end()) return nullptr;
		return it->second(std::forward<Args>(args)...);
	}

	template <class T>
	static void Register(const Key &name)
	{
		auto registry = GetStorage();
		
		// print the address of registry
		cout << "registry: " << &registry << endl;
		registry->emplace(name, [](Args&&... args) {return (make_shared<T>(std::forward<Args>(args)...)); });
	}

private:
	using FactoryStorage = std::unordered_map<std::string, std::function<shared_ptr<Result>(Args&&... args)>>;

	static shared_ptr<FactoryStorage> GetStorage()
	{
		// cout << "create map" << endl;
		static auto registry = make_shared<FactoryStorage>();
		return registry;
	}
};

using BaseFactory = FactoryRegistry<Base, std::string, std::string>;

class Test: public Base {
	private:
	std::string name;
	public:
	Test(std::string name) {
		this->name = std::move(name);
	}

	void printName() override {
		std::cout << name << std::endl;
	}
};

#define REGISTER_FACTORY(FACTORY, cls_name, cls, name)                           \
  struct AutoRegister_##cls_name : AutoRegister<AutoRegister_##cls_name> { \
    static void Register() {                                                      \
      FACTORY::Register<cls>(name);                                               \
    }                                                                             \
    static void Foo() {                                                           \
      (void)__proxy;                                                              \
    }                                                                             \
  };

#define REGISTER_BASE(cls, name) \
  REGISTER_FACTORY(BaseFactory, cls, cls, name)

class Test2: public Base {
	
	public:
	Test2(std::string name) {
	}

	void printName() override {
		std::cout << "shabi" << std::endl;
	}
};

REGISTER_BASE(Test, "Test");

int main()
{
	// Test::Register();
	auto obj = BaseFactory::Make("Test", "zhu");
	obj->printName();
}
```