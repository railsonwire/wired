const store = {
  components: {}, // id: val
  addComponent(c){
    return this.components[c.id] = c
  },
  getComponent(id){
    return this.components[id]
  },
  removeComponent(id){
    delete this.components[id]
  },
  closestComponent(el){
    let closestRoot = Alpine.findClosest(el, i => i.__wired)

    if (!closestRoot) { return }

    return closestRoot.__wired
  }
}

export default store