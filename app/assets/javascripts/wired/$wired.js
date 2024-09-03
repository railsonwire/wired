import store from "./store"
import Alpine from 'alpinejs'

let methods = {}
function setWiredMethod(name, callback, component = null) {
  methods[name] = callback
}

let callfunc
function setCallFunc(callback) {
  callfunc = callback
}

export function generateWiredObject(component, state){
  return new Proxy({}, {
    get(target, property) {
      if (property in state) {
        return state[property]
      } else if (property in methods) {
        // $wired methods
        return methods[property](component)
      }else{
        // function call
        return callfunc(component)(property)
      }
    },

    set(target, property, value) {
      if (property in state) {
        state[property] = value
      }

      return true
    },
  })
}

Alpine.magic('wired', (el, { cleanup }) => {
  let component

  return new Proxy({}, {
    get(target, property) {
      if(! component) component = store.closestComponent(el)

      if (property == 'entangle') {
        return generateEntangleFunction(component, cleanup)
      }

      return component.$wired[property]
    },

    set(target, property, value) {
      if(! component) component = store.closestComponent(el)

      component.$wired[property] = value

      return true
    },
  })
})

setCallFunc((component) => (property) => (...params) => {
  component.requestUpdate({type: 'callMethod', data: {method: property, params}});
})

setWiredMethod('get', (component) => (property, reactive = true) => dataGet(component.reactive, property))
setWiredMethod('set', (component) => async (property, value, live = true) => {
  dataSet(component.reactive, property, value)

  // Send a request, queueing the property update to happen first
  // on the server, then trickle back down to the client and get merged...
  if (live) {
    component.requestUpdate({type: 'syncInput', data: {model: property, value: value}});
  }

  return Promise.resolve()
})
setWiredMethod('refresh', (component) => () => {
  component.requestUpdate({type: 'refresh', data: {}});
})

// main entangle
function generateEntangleFunction(component, cleanup){
  if (! cleanup) cleanup = () => {}

  return (name) => {
    let isLive = true
    let wiredProperty = name
    let wiredComponent = component.$wired
    let wiredPropertyValue = wiredComponent.get(wiredProperty)

    let interceptor = Alpine.interceptor((initialValue, getter, setter, path, key) => {
      // Check to see if the Livewire property exists and if not log a console error
      // and return so everything else keeps running.
      if (typeof wiredPropertyValue === 'undefined') {
        console.error(`Property ['${wiredProperty}'] cannot be found on component: ['${component.name}']`)
        return
      }

      let release = Alpine.entangle({
        // Outer scope...
        get() {
          return wiredComponent.get(name)
        },
        set(value) {
          wiredComponent.set(name, value, isLive)
        }
      }, {
        // Inner scope...
        get() {
          return getter()
        },
        set(value) {
          setter(value)
        }
      })

      cleanup(() => release())

      return cloneIfObject(wiredComponent.get(name))
    }, obj => {
      Object.defineProperty(obj, 'live', {
        get() {
          isLive = true

          return obj
        }
      })
    })

    return interceptor(wiredPropertyValue)
  }
}

// utils

export function dataGet(object, key){
  if (key === '') return object

  return key.split('.').reduce((carry, i) => {
    if (carry === undefined) return undefined

    return carry[i]
  }, object)
}

export function dataSet(object, key, value) {
  let segments = key.split('.')

  if (segments.length === 1) {
      return object[key] = value
  }

  let firstSegment = segments.shift()
  let restOfSegments = segments.join('.')

  if (object[firstSegment] === undefined) {
      object[firstSegment] = {}
  }

  dataSet(object[firstSegment], restOfSegments, value)
}

function cloneIfObject(value) {
  return typeof value === 'object'
    ? JSON.parse(JSON.stringify(value))
    : value
}
