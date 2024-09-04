import Component from "./component"
import nodeUtils from "./nodeUtils"
import store from "./store"

import collapse from '@alpinejs/collapse'
import focus from '@alpinejs/focus'
import persist from '@alpinejs/persist'
import intersect from '@alpinejs/intersect'
import anchor from '@alpinejs/anchor'
import morph from '@alpinejs/morph'
import mask from '@alpinejs/mask'
import Alpine from 'alpinejs'
import DOMItem from "./domItem"

class Wired {
  constructor(){
    this.components = store
  }

  start() {
    /* all (most unused) */
    Alpine.plugin(morph)
    Alpine.plugin(intersect)
    Alpine.plugin(collapse)
    Alpine.plugin(anchor)
    Alpine.plugin(focus)
    Alpine.plugin(persist)
    Alpine.plugin(mask)

    /* https://github.com/livewire/livewire/blob/main/js/lifecycle.js#L32 */
    Alpine.addRootSelector(() => '[wired\\:id]')

    Alpine.onAttributesAdded((el, attributes) => {
      // if there are no "wire:" directives we don't need to process this element any further.
      // This prevents Livewire from causing general slowness for other Alpine elements on the page...
      if ( !Array.from(attributes).some(attribute => attribute.name.match(new RegExp('wired:'))) ) return

      let component = store.closestComponent(el)

      if (!component) return

      const element = new DOMItem(el)
      nodeUtils.init(element, component)

      // no idea what this does, hopefully the same thing i do in the init
      // attributes.forEach(attribute => {
      //   if (!attribute.name.match(new RegExp('wired:'))) return;

      //   let directive = extractDirective(el, attribute.name)

      //   trigger('directive.init', { el, component, directive, cleanup: (callback) => {
      //     Alpine.onAttributeRemoved(el, directive.raw, callback)
      //   } })
      // })
    })

    Alpine.interceptInit(
      Alpine.skipDuringClone(el => {
        // if there are no "wire:" directives we don't need to process this element any further.
        // This prevents Livewire from causing general slowness for other Alpine elements on the page...
        if ( !Array.from(el.attributes).some(attribute => attribute.name.match(new RegExp('wired:'))) ) return

        if (el.hasAttribute('wired:initial')) {
          const node = new DOMItem(el)
          let component = store.addComponent(new Component(node))
          // let component = initComponent(el)

          // Alpine.onAttributeRemoved(el, 'wire:id', () => {
          //     destroyComponent(component.id)
          // })
        }

        let component = store.closestComponent(el)

        if (component) {
          const element = new DOMItem(el)
          nodeUtils.init(element, component)

          // no idea what this does, hopefully the same thing i do in the init
          // trigger('element.init', { el, component })

          // let directives = Array.from(el.getAttributeNames())
          //     .filter(name => matchesForLivewireDirective(name))
          //     .map(name => extractDirective(el, name))

          // directives.forEach(directive => {
          //   trigger('directive.init', { el, component, directive, cleanup: (callback) => {
          //     Alpine.onAttributeRemoved(el, directive.raw, callback)
          //   } })
          // })
        }
      })
    )

    nodeUtils.rootElementsWithNoParents().forEach(el => {
      this.components.addComponent(new Component(el))
    })

    // init alpine
    Alpine.start()
  }

  parseOutMethodAndParams(rawMethod) {
    let method = rawMethod
    let params = []
    const methodAndParamString = method.match(/(.*?)\((.*)\)/)

    if (methodAndParamString) {
        method = methodAndParamString[1]
        // use a function that returns it's arguments to parse and eval all params
        params = eval(`(function () {
            for (var l=arguments.length, p=new Array(l), k=0; k<l; k++) {
                p[k] = arguments[k];
            }
            return [].concat(p);
        })(${methodAndParamString[2]})`)
    }

    return { method, params }
  }
}

window.Wired = Wired
window.Alpine = Alpine

document.addEventListener("DOMContentLoaded", function () {
  window.wired = new Wired
  window.wired.start()

  let pendingEvents = sessionStorage.getItem('wired_event_queue_next')
  if(pendingEvents){
    let eventsArray = JSON.parse(pendingEvents)
    eventsArray.forEach(event => {
      const e = new CustomEvent(event.event, {
          bubbles: true,
          detail: event.data,
      })
      window.dispatchEvent(e)
    })
    sessionStorage.removeItem('wired_event_queue_next')
  }
});

export { Wired, Alpine }