import store from './store'
import nodeUtils from './nodeUtils';
import DOMItem from './domItem';
import { generateWiredObject } from './$wired';

import { DirectUpload } from '@rails/activestorage'

export default class Component {
  constructor(el){
    el.domNode().__wired = this
    this.id = el.getWiredAttribute("id")
    this.state = JSON.parse(this.extractState())
    this.actionQueue = []
    this.isUpdating = false
    // useful attrs
    this.name = this.state.refs.name
    this.uploads = {}
    // reactive
    this.initialState = nodeUtils.extractData( JSON.parse(JSON.stringify(this.state.data)) )
    this.liveState = nodeUtils.extractData( JSON.parse(JSON.stringify(this.state.data)) )

    this.reactive = Alpine.reactive(this.liveState)
    this.$wired = generateWiredObject(this, this.reactive)

    this.processEffects(JSON.parse(this.extractEffects())) // redirect/events

    this.init()

    // console.log(this)
  }

  extractState(){
    const value = this.el.getWiredAttribute('initial')
    this.el.removeWiredAttribute('initial')
    return value
  }

  extractEffects(){
    const value = this.el.getWiredAttribute('effects')
    this.el.removeWiredAttribute('effects')
    return value
  }

  processEffects(effects){
    if(effects.redirectTo){
      // process dispatch on next page
      if(effects.eventQueueNext.length){
        let queue = []
        effects.eventQueueNext.forEach(event => {
          const data = event.data ? event.data : {}
          queue.push({event: event.event, data: data})
        })
        sessionStorage.setItem('wired_event_queue_next', JSON.stringify(queue))
      }
      window.location.href = effects.redirectTo
    }

    /* https://github.com/livewire/livewire/blob/1.x/js/component/index.js#L188 */
    if(effects.eventQueue.length){
      effects.eventQueue.forEach(event => {
        const data = event.data ? event.data : {}
        const e = new CustomEvent(event.event, {
            bubbles: true,
            detail: data,
        })
        this.el.domNode().dispatchEvent(e)
      })
    }
  }

  init() {
    this.walk(
      el => { nodeUtils.init(el, this) },
      el => { store.addComponent(new Component(el)) }
    )
  }

  upload(name, file) {
    this.startUpload({
      name: name,
      files: [file],
      multiple: false
    })
  }

  uploadMultiple(name, files) {
    this.startUpload({
      name: name,
      files: Array.from(files),
      multiple: true
    })
  }

  startUpload(uploadObj){
    const name = uploadObj.name;
    const isMultiple = uploadObj.multiple;
    uploadObj.files.forEach((file) => {
      const upload = new DirectUpload(
        file,
        '/rails/active_storage/direct_uploads', // This url is exposed by default in your app
      );
      upload.create((error, blob) => {
        if(error){
          console.log("ERROR UPLOADING FILE:", error)
        }else{
          this.setUploaded(name, blob)

          if(this.uploads[name].length == uploadObj.files.length){
            this.requestUpdate({
              type: 'callMethod',
              data: { method: 'setUpload', params: [name, this.uploads[name], isMultiple] }
            })
          }
        }
      });
    });
  }

  setUploaded(name, blob){
    // add to bag
    if(!this.uploads[name]) this.uploads[name] = []
    this.uploads[name].push(blob)
  }

  requestUpdate(action){
    this.actionQueue.push(action)
    // 5ms debounce for same-time request (eg. model + input)
    nodeUtils.debounce(this.fireUpdate, 5).apply(this)
  }

  fireUpdate(){
    if(this.isUpdating) return
    this.isUpdating = true

    this.sendUpdates()

    this.actionQueue = []
  }

  sendUpdates(){
    const payload = this.actionQueue
    // console.log('updating', payload, this)
    fetch(`/wired/${this.name}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/html, application/xhtml+xml',
        'X-CSRF-TOKEN': nodeUtils.csrfToken(),
      },
      body: JSON.stringify({
        updates: payload,
        state: this.state
      })
    }).then((r) => {
      if(r.ok){
        r.json().then((response) => {
          const state = response.state
          const thisComponent = store.getComponent(state.refs.id)
          thisComponent.handleResponse(response)
    
          // This bit of logic ensures that if actions were queued while a request was
          // out to the server, they are sent when the request comes back.
          if (this.actionQueue.length > 0) {
            this.fireUpdate()
          }
        }).catch((err) => {
          console.log('UPDATE ERROR', err);
        })
      }else{
        // render errors as server errors
        // TODO this might be wrong
        r.text().then((response) => {
          document.documentElement.innerHTML = response
        })
      }
    })
  }

  handleResponse(response){
    this.state = response.state

    // update state
    this.initialState = nodeUtils.extractData( JSON.parse(JSON.stringify(this.state.data)) )
    this.liveState = nodeUtils.extractData( JSON.parse(JSON.stringify(this.state.data)) )

    // update alpine live state
    let newData = nodeUtils.extractData( JSON.parse(JSON.stringify(this.state.data)) )
    Object.entries(this.liveState).forEach(([k, v]) => {
      this.reactive[k] = newData[k]
    })

    this.processEffects(response)

    // if(response.redirectTo){
    //   // process dispatch on next page
    //   if(response.eventQueueNext.length){
    //     let queue = []
    //     response.eventQueueNext.forEach(event => {
    //       const data = event.data ? event.data : {}
    //       queue.push({event: event.event, data: data})
    //     })
    //     sessionStorage.setItem('wired_event_queue_next', JSON.stringify(queue))
    //   }
    //   window.location.href = response.redirectTo
    //   return
    // }

    this.morphHTML(response.html)

    this.refreshDataBoundElements()

    this.isUpdating = false

    // /* https://github.com/livewire/livewire/blob/1.x/js/component/index.js#L188 */
    // if(response.eventQueue.length){
    //   response.eventQueue.forEach(event => {
    //     const data = event.data ? event.data : {}
    //     const e = new CustomEvent(event.event, {
    //         bubbles: true,
    //         detail: data,
    //     })
    //     this.el.domNode().dispatchEvent(e)
    //   })
    // }

    // console.log('updated', this)
  }

  walk(callbackDefault, callbackForNewComponent = el => {}) {
    nodeUtils.walk(this.el.domNode(), node => {
        const el = new DOMItem(node)

        if (el.isSameNode(this.el)) {
            callbackDefault(el)
            return
        }

        if (el.isComponentRoot()) {
            callbackForNewComponent(el)
            return false
        }

        if (callbackDefault(el) === false) {
          return false
        }
    })
  }

  get(name) {
    let segments = name.split('[').map((k) => k.replace(/['"\]]/g, '').split('.')).flat()
    return segments
      .reduce(
          (carry, dotSeperatedSegment) => carry[dotSeperatedSegment],
          this.liveState
      )
  }

  get el(){
    return new DOMItem(document.querySelector(`[wired\\:id="${this.id}"]`))
  }

  /* https://github.com/livewire/livewire/blob/main/js/morph.js */
  /* https://github.com/livewire/livewire/blob/1.x/js/component/index.js#L272 */
  morphHTML(html){
    let component = this
    let rootEl = this.el

    let wrapperTag = rootEl.el.parentElement
        // If the root element is a "tr", we need the wrapper to be a "table"...
        ? rootEl.el.parentElement.tagName.toLowerCase()
        : 'div'
    let wrapper = document.createElement(wrapperTag) // placeholder for content
    wrapper.innerHTML = html

    let parentComponent = store.closestComponent(rootEl.el.parentElement)
    parentComponent && (wrapper.__wired = parentComponent)

    let to = wrapper.firstElementChild
    to.__wired = component

    Alpine.morph(rootEl.el, to, {
      updating: (el, toEl, childrenOnly, skip) => {
        if (typeof el.hasAttribute !== 'function') return

        if (el.__wired_ignore === true) return skip()

        // Children will update themselves.
        if (el.hasAttribute('wired:id') && el.getAttribute('wired:id') !== component.id) return skip()

        if (el.hasAttribute('wired:id')){
          toEl.__wired = component
          toEl.setAttribute('wired:id', component.id)
        }
        // if(Alpine.$data(el)){
        //   window.Alpine.cloneNode(el, toEl) // should clone x-data
        // }
      }
    })
  }

  refreshDataBoundElements(){
    this.walk(el => {
      if(!el.domNode().directives['model']) return

      if(el.isFocused()) return // typing

      el.setValueFromModel(this)
    })
  }
}
