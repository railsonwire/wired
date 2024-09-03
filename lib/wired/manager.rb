module Wired
  class Manager
    def self.mount(context, name, args={})
      component = build(context, name, args)

      id = SecureRandom.hex
      component.setId(id)

      component.mount

      # html = component.render_layout
      # state = component.serialized_state

      stateData, redirectTo, eventQueue, eventQueueNext, html = component.prepare_response

      initialData = {
        effects: {
          redirectTo: redirectTo,
          eventQueue: eventQueue,
          eventQueueNext: eventQueueNext
        },
        state: {
          data: stateData,
          refs: {
            id: id,
            name: name.underscore,
          }
        }
      }

      injectWiredIntoHtml(html, initialData)
    end

    def self.fromState(context, state)
      name = state[:refs][:name]
      data = restore(state[:data])

      component = build(context, name, data)
      component.setId(state[:refs][:id])

      return component
    end

    def to_s
      @html
    end

    private

    def self.build(context, name, args)
      className = "#{name.camelcase}Component"
      componentClass = className.safe_constantize
      raise "component #{name} not found" unless componentClass

      return componentClass.new(context, args)
    end

    # PACKS VARIABLES INTO JSON
    def self.serialize(value)
      return [value, { type: 'i' }] if value.is_a? Integer
      return [value, { type: 'f' }] if value.is_a? Float
      return [value, { type: 'd' }] if value.is_a? Date
      return [value, { type: 'dt' }] if value.is_a?(DateTime) || value.is_a?(ActiveSupport::TimeWithZone)
      return value if [NilClass, String, FalseClass, TrueClass].any?{|c| value.is_a? c}
      return [value.map{|e| serialize(e)}, { type: 'a' }] if value.is_a? Array
      return [value.map{|k,v| [k, serialize(v)]}.to_h, { type: 'h' }] if value.is_a? Hash

      raise StandardError.new("Invalid property class: #{value.class.name}") unless value.is_a?(ActiveRecord::Base) || value.is_a?(ActiveRecord::Relation)
      return [value, { type: 'm', class: (value.class.name == 'ActiveRecord::Relation' ? value.klass.name : value.class.name) }]
    end

    # UNPACKS JSON INTO VARIABLES
    def self.deserialize(data)
      value, meta = data

      return value if meta.nil?
      return value.to_i if meta[:type] == 'i'
      return value.to_f if meta[:type] == 'f'
      return Date.parse(value) if meta[:type] == 'd'
      return DateTime.parse(value) if meta[:type] == 'dt'
      return value.map{|e| deserialize(e)} if meta[:type] == 'a'
      return value.map{|k,v| [k, deserialize(v)]}.to_h if meta[:type] == 'h'

      modelClass = meta[:class].constantize

      raise StandardError.new("Invalid property class: #{meta[:class]}") unless modelClass.superclass.name.in? ['ApplicationRecord', 'ActiveStorage::Record']

      # model -> try retrieve results by query
      # 1. array: collection -> where id
      # 2. hash: id ? find : new by params
      modelValue = value.is_a?(Array) ? modelClass.where(id: value.map{|r| r[:id]}) : (value[:id].present? ? modelClass.find(value[:id]) : modelClass.new(value))
      return modelValue
    end

    def self.restore(payload)
      state = {}

      payload.each{ |key, data| state[key] = deserialize(data) }

      return state
    end

    def self.injectWiredIntoHtml(html, initialData)
      match = html.match(/<([a-zA-Z]*)/)
      raise 'No root tag for component' unless match

      rootTag = match[0]
      initialState = initialData[:state]
      effects = initialData[:effects]

      @html = html.sub(rootTag, "#{rootTag} wired:id='#{initialState[:refs][:id]}' wired:initial='#{initialState.to_json}' wired:effects='#{effects.to_json}'")
    end
  end
end