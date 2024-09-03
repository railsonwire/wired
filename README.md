# Wired
Livewire port wannabe for Ruby on Rails

## Usage
This gem **replaces** the turbo ecosystem, you cannot use both at the same time (and you shouldn't want to)

A lot (all) of the ideas and behaviours are inspired by (copied from) Livewire.

You can create a new component with
```bash
$ rails g wired:new CamelCaseName
```
This will create a rails component `CamelCaseNameComponent` in `app/components/camel_case_name_component.rb`and a view file in `app/views/components/camel_case_name.html.erb`.

To render your component in a page simply do
```html
<%== Wired::Manager.mount(self, 'CamelCaseName', *your_arguments={}) %>
```
You can treat the view file like a normal rails view, with the instance variables being the ones in the component instance.

### 1. Mount
To initialize variables you can use the mount method inside the component file:
```ruby
# app/components/form_component.rb
class FormComponent < Wired::BaseComponent

  def mount
    @fields = {name: '', surname: ''}
    @relations = []
  end

  def render_layout
    view('components/form')
  end
end
```

This will run only once at initialization, before anything else. You might want to use it like this:
```html
<!-- your_view.html.erb -->
<%== Wired::Manager.mount(self, 'User', { id: params[:id] }) %>
```
```ruby
# app/components/user_component.rb
class UserComponent < Wired::BaseComponent

  def mount
    @user = User.find(@id)
  end

  # ...
end
```

### 2. Render
The method `render_layout` needs to be present and needs to contain the instruction `view(path)` to know which view file to render.

This method is run every time your component's state updates or one of its function gets called. You're free to do any elboration you might need before the `view` instruction, as well as to provide additional parameters to pass to your view (as locals):
``` rb
# app/components/example_component.rb

# ...

def render_layout
  items = User.all
  items = items.where("email ILIKE ?", "%#{@search}%") if @search.present?

  view('components/example', items: items)
end
```

Just be aware that this will run on every update.

### 3. Modeling
In alpine fashion you can bind inputs to component variables. Instead of using `x-model` use `wired:model`:
```html
<!-- app/views/components/form.html.erb -->
<div>
  <input type="text" wired:model="fields['name']" placeholder="name">
  <input type="text" wired:model="fields.surname" placeholder="surname">
  <!-- ... -->
</div>
```
```ruby
# app/components/form_component.rb
class FormComponent < Wired::BaseComponent

  def mount
    @fields = {name: '', surname: ''}
  end

  # ...
end
```
Here the component variable `@fields` will be updated live every time the two inputs are typed in.  Note the javascript syntax for the `wired:model` attribute, the keys **need** to be defined at the component level, or the view cannot update correctly.

### 4. Actions
At this moment the only supported triggering actions are:
- input
- change
- click
- submit

For any of these you can attach the attribute `wired:action` to an html element to call a component function:
```html
<!-- app/views/components/_form.html.erb -->
<div>
  <input type="text" wired:model="fields['name']" placeholder="name">
  <input type="text" wired:model="fields.surname" placeholder="surname">
  <!-- ... --->
  <button type="button" wired:click="submit">submit</button>
</div>
```
```ruby
# app/components/form_component.rb
class FormComponent < Wired::BaseComponent
  def mount
    @fields = {name: '', surname: ''}
  end

  def submit
    User.create(@fields)
    # ...
  end

  # ...
end
```
Clicking on the button will result in the execution of the `submit` function.

### 5. Redirect
You might want to redirect to a different page or controller after an action or update. To do so simply call the `redirect` function like so:
```ruby
# ...
def submit
  User.create(@fields)
  # ...
  redirect(users_path)
end
```

### 6. Dispatch
You also might want to trigger javascript events on your view as consequences of component actions. To do simply call the `dispatch` function like so:
```ruby
# ...
def delete
  user = User.find(@id)
  user.destroy
  # ...
  dispatch('user-deleted', {user: user})
end
```
This will dispatch a customEvent "user-deleted" with the details provided, which can be listened for like this:
```js
// main.js
window.addEventListener('user-deleted', function(e){
  alert(`deleted user: ${e.detail.user.surname} ${e.detail.user.name}`);
});
```
Sometimes it might be needed to use both `redirect` and `dispatch` in a single action, for example redirecting to the homepage and then showing an alert.  
The default `dispatch` wouldn't work in this case cause the page load "cancels" the event trigger, so you'll have to use `dispatchOnNextPage` (with the same syntax)
```ruby
def delete
  # ...
  @user.destroy

  redirect(users_path)
  dispatchOnNextPage('user-deleted', {user: user}) # will trigger in users_path
```
note that the order of `redirect` and `dispatch` is indifferent in this case.

### 7. Polling
Sometimes you might want your component to refresh its data or call a function periodically.  
To do this use the `wired:poll` directive:
```html
<!-- app/views/components/poll_component.rb -->
<div>
  <div wired:poll>
    <!-- content to update periodically -->
  </div>

  <div wired:poll.5s="updateData()">
    <!-- content -->
  </div>
</div>
```
1. without modifiers or values `wired:poll` refreshes the content every 2 seconds
2. use the modifiers to change the time of the interval (eg. '1s', '500ms', ..)
3. use the attribute value to pick what function to run instead of the refresh

Note that this directive runs an ajax call every N seconds/millis so be mindful when using it :)

### 8. Nesting
It is possible to render components inside other components, just call the mount function:
```html
<!-- your_view.html.erb -->
<%== Wired::Manager.mount(self, 'Parent') %>
```
```html
<!-- app/views/components/parent.html.erb -->
<div>
  <h1>I'm the parent</h1>

  <%== Wired::Manager.mount(self, 'Child') %>
</div>
```
```html
<!-- app/views/components/child.html.erb -->
<div>
  <h1>And I'm the child</h1>

  <!-- ... --->
</div>
```
A few notes:
1. Only use this if the child **needs** wired functionalities, most times a normal rails partial will be sufficient
2. Currently there is no parent-children communication, they live independently to one another

### 9. Alpine / $wired
Wired, much like livewire, ships with alpinejs and all its plugins already enabled and it's designed to work seamlessly with it.

This means that you can effectively use alpine's functionalities to trigger and interact with the backend component, using the magic `$wired`. A simple example would be the following:

```ruby
# app/components/counter_component.rb
class CounterComponent < Wired::BaseComponent

  def mount
    @total = 0
  end

  def add
    @total += 1
  end

  def set_count(n)
    @total = n
  end

  def render_layout
    view('components/counter')
  end
end
```
```html
<!-- app/views/components/counter.html.erb -->
<div>
  <div>
    <strong><%= @total %></strong>
    <button wired:click="add">+</button>
  </div>

  <div x-data>
    <strong x-text="$wired.total"></strong>
    <button x-on:click="$wired.set_count(69)">:)</button>
  </div>
</div>
```
Pressing on the "+" button updates the component state, increasing `total` by 1.  This reflects on the internal $wired object which is displayed with `x-text`.  
Therefore pressing the button updates both the erb interpolation AND the x-text.  
Similarly for the "funny" button: the component state updates through the `set_count` function triggered by the `x-on:click`, setting both the erb interpolation AND the x-text once again. 
Pretty nice.

But what if i want alpine variables and functions to reflect into the backend state? Here comes `entangle`:
```html
<div>
  <div>
    <strong><%= @total %></strong>
    <button wired:click="add">+</button>
  </div>

  <div>
    <div x-data="{value: $wired.entangle('total') }">
      <strong x-text="value"></strong>
      <button x-on:click="value = 69">:)</button>
    </div>
  </div>
</div>
```
The behavior of this snippet is exactly the same as the previous, with the exception that the component state is directly updated by alpine, not by calling backend functions.

### 10. Ignore
Sometimes you'll want an element on the page to not re-render or update (or change in general) as a consequence of wired. To do this mark the element with the attribute `wired:ignore`
```html
<!-- some_component.html.erb -->
...
<div wired:ignore>
  I wont change!
</div>
...
```

## Things to note
- All the instance variables need to be serialized to perform updates. Currently the only classes for which serialization is supported are:
  | | |
  |-|-|
  | Primitive types | `Integer` `Float` `NilClass` `FalseClass` `TrueClass` `Hash` `Array` `String` |
  | Date types | `Date` `DateTime`|
  | ActiveRecords | `ActiveRecord::Base` `ActiveRecord::Relation` |

  If you try to use instance variables that are NOT included you will get an _"Invalid property class"_ error

- Using date/time input types with a `wired:model` initialized as  `nil` or `""` cannot produce a date/time, but a `String` at most. If you want to use date/time types for your variable please initialize it as such so that wired can handle the type casting.  
The same is generally true for all types, wired cannot infer the type of a variable based on the input type that it's modeled with.

- To be able to use `wired:model` on file uploads you need to have `ActiveStorage` installed:
  >`rails active_storage:install`  
  >`rails db:migrate`

## Installation
Add this line to your application's Gemfile:

```ruby
gem "wired", git: "https://github.com/railsonwire/wired.git"
```

And then execute:
```bash
$ bundle
```

Run the installer:
```bash
$ rails g wired:install
```

Finish by:
1. copy into your `config/application.rb`:
```ruby
config.autoload_paths << Rails.root.join('/app/components')
```
2. import the javascript part of the gem in your main js file:
```js
import 'wired'
```

You should remove **all** your Alpinejs imports and dependencies (from `package.json` or your main js files), wired ships with everything by default and it may lead to conflicts.

## TODOS
* ~~component attrs keep original class~~ (should work in most cases)
* ~~view partials without `local_assigns`~~
* ~~view variables with @~~
* ~~handle nested components~~
* ~~preserve alpine~~
* ~~model syntacjson (attr.subattr[key])~~
* ~~custom mount method for component~~
* directive modifiers like alpine
* ~~dispatch event component->view~~
* ~~redirect~~
* ~~$wired~~
* ~~entangle~~
* parent-children communication

and all the `TODO` you find in the source

## KNOWN ISSUES
- Doesn't work too well when combining `wired:model` and `x-model`, for now use one or the other (or the `$wired` magic)