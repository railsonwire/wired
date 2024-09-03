import store from "./store"

export default class DOMItem {
  constructor(el){
    this.el = el
    this.el.directives ||= {} // name: func
    this.el.clocks ||= {} // time: interval
  }

  domNode(){
    return this.el
  }

  isSameNode(el){
    if (typeof el.domNode === 'function') {
      return this.el.isSameNode(el.domNode())
    }

    return this.el.isSameNode(el)
  }

  isComponentRoot() {
    return this.el.hasAttribute('wired:id')
  }

  isFocused() {
    return this.el === document.activeElement
  }

  hasWiredAttribute(attribute) {
    return this.el.hasAttribute(`wired:${attribute}`)
  }

  getWiredAttribute(attr){
    return this.el.getAttribute(`wired:${attr}`)
  }

  removeWiredAttribute(attr){
    return this.el.removeAttribute(`wired:${attr}`)
  }

  addEventListener() {
    return this.el.addEventListener(...arguments)
  }

  removeEventListener() {
    return this.el.removeEventListener(...arguments)
  }

  getDirectives(){
    return Array.from(this.el.getAttributeNames()
            // Filter only the wired directives.
            .filter(name => name.match(/^wired:/))
            // Parse out the type, modifiers, and value from it.
            .map(name => {
              let [value, modifier] = name.replace(/^wired:/, '').split('.')
              let expression = this.el.getAttribute(name)
              return {name: value, modifier: modifier, expression: expression}
            }))
  }

  registerUploader(expression, component){
    if(this.el.tagName.toLowerCase() != 'input' && this.el.type != 'file') return

    // remove previous instance
    if(this.el.directives['upload']){
      this.el.removeEventListener('change', this.el.directives['upload'])
      delete this.el.directives['upload']
    }
    this.el.addEventListener('change', this.el.directives['upload'] = function(e){
      if (e.target.files.length === 0) return

      // start()
      console.log('started upload')

      if (e.target.multiple) {
        component.uploadMultiple(expression, e.target.files)
      } else {
        component.upload(expression, e.target.files[0])
      }
    })
  }

  /* preso paro paro da lw1 */
  inputValue(component){
    if (this.el.type === 'checkbox') {
      const modelName = this.getWiredAttribute('model')
      var modelValue = component.get(modelName)

      if (Array.isArray(modelValue)) {
        if (this.el.checked) {
          modelValue = modelValue.includes(this.el.value)
            ? modelValue
            : modelValue.concat(this.el.value)
        } else {
          modelValue = modelValue.filter(
            item => item !== this.el.value
          )
        }

        return modelValue
      }

      if (this.el.checked) {
        return this.el.getAttribute('value') || true
      } else {
        return false
      }
    } else if (this.el.tagName === 'SELECT' && this.el.multiple) {
      return Array.from(this.el.options)
                  .filter(option => option.selected)
                  .map(option => {
                      return option.value || option.text
                  })
    }

    return this.el.value
  }

  setValueFromModel(component){
    const modelName = this.getWiredAttribute('model')
    const modelValue = component.get(modelName)

    // undefined is nop
    if (modelValue === undefined) return

    this.setValue(modelValue)
  }

  setValue(value){
    if (this.el.type === 'radio') {
      this.el.checked = this.el.value == value
    } else if (this.el.type === 'checkbox') {
      if (Array.isArray(value)) {
        // I'm purposely not using Array.includes here because it's
        // strict, and because of Numeric/String mis-casting, I
        // want the "includes" to be "fuzzy".
        let valueFound = false
        value.forEach(val => {
          if (val == this.el.value) {
            valueFound = true
          }
        })

        this.el.checked = valueFound
      } else {
        this.el.checked = !!value
      }
    } else if (this.el.tagName === 'SELECT') {
        this.updateSelect(value)
    } else {
        this.el.value = value
    }
  }

  updateSelect(value) {
    const arrayWrappedValue = [].concat(value).map(value => {
      return value + ''
    })

    Array.from(this.el.options).forEach(option => {
      option.selected = arrayWrappedValue.includes(option.value)
    })
  }
}