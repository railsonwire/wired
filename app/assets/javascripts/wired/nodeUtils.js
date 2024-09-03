import DOMItem from "./domItem"

export default {
  rootElementsWithNoParents(){
    const allEls = Array.from(document.querySelectorAll(`[wired\\:id]`))
    const onlyChildEls = Array.from(document.querySelectorAll(`[wired\\:id] [wired\\:id]`))
  
    return allEls.filter(el => ! onlyChildEls.includes(el)).map(el => new DOMItem(el))
  },

  csrfToken(){
    return document.head.querySelector('meta[name="csrf-token"]').content
  },

  debounce(func, wait){
    var timeout
    return function () {
        var context = this, args = arguments
        var later = function () {
            timeout = null
            func.apply(context, args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
  },

  init(el, component){
    el.getDirectives().forEach((d) => {
      // d = { name: 'model', modifier: '', expression: 'modelVar'}
      // d = { name: 'poll', modifier: '1s', expression: 'funcToCall()'}
      const directiveName = d.name
      const modifier = d.modifier
      const expression = d.expression
      switch(directiveName){
        case 'model':
          // no file uploads
          if (
            el.domNode().tagName.toLowerCase() === 'input' &&
            el.domNode().type === 'file'
          ){
            el.registerUploader(expression, component)
            break;
          }

          // set initial value
          el.setValueFromModel(component)
          // add event listener
          const event =
            el.domNode().tagName.toLowerCase() === 'select' ||
            ['checkbox', 'radio'].includes(el.domNode().type)
              ? 'change'
              : 'input'

          // remove previous instance
          if(el.domNode().directives[directiveName]){
            el.removeEventListener(event, el.domNode().directives[directiveName])
            delete el.domNode().directives[directiveName]
          }
          el.addEventListener(event, el.domNode().directives[directiveName] = function(e){
            const model = expression
            const value = el.inputValue(component)

            component.requestUpdate({type: 'syncInput', data: {model, value}});
          })

          break;
        case 'poll':
          // get time from modifier || 2sec
          let time = 2000 // ms
          let timeInMs = modifier && modifier.match(/([0-9]+)ms/)
          let timeInS = modifier && modifier.match(/([0-9]+)s/)
          if(timeInMs){
            time = Number(modifier.replace('ms', ''))
          }else if(timeInS){
            time = Number(modifier.replace('s', '')) * 1000
          }

          let element = el.domNode()
          // stop and remove previous instance
          if(element.clocks[time]){
            clearInterval(element.clocks[time])
            delete element.clocks[time]
          }

          let clock = setInterval(() => {
            if(!element.isConnected){ clearInterval(clock) }

            Alpine.evaluate(element,
              expression ? '$wired.' + expression : '$wired.refresh()'
            )
          }, time)

          element.clocks[time] = clock

          break;
        case 'ignore':
          el.domNode().__wired_ignore = true
          break
        case 'click':
        case 'input':
        case 'change':
        case 'submit':
          // remove previous instance
          if(el.domNode().directives[directiveName]){
            el.removeEventListener(directiveName, el.domNode().directives[directiveName])
            delete el.domNode().directives[directiveName]
          }
          el.addEventListener(directiveName, el.domNode().directives[directiveName] = function(e){
            if(directiveName == 'submit'){ e.preventDefault(); } /* https://github.com/livewire/livewire/blob/main/js/directives/wire-wildcard.js#L12 */

            let action = expression;
            const { method, params } = wired.parseOutMethodAndParams(action)

            component.requestUpdate({type: 'callMethod', data: {method, params}});
          });

          break;
      }
    })
  },

  walk(startNode, callback){
    if (callback(startNode) === false) return

    let node = startNode.firstElementChild

    while (node) {
      this.walk(node, callback)
      node = node.nextElementSibling
    }
  },

  /* https://github.com/livewire/livewire/blob/main/js/utils.js#L154 */
  isSerializedObJ(obj){
    return Array.isArray(obj) && obj.length === 2 && typeof obj[1] === 'object'
  },

  extractData(payload){ // [value, metadata]
    let value = this.isSerializedObJ(payload) ? payload[0] : payload
    let meta = this.isSerializedObJ(payload) ? payload[1] : undefined

    if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, iValue]) => {
        value[key] = this.extractData(iValue)
      })
    }

    return value
  }
}