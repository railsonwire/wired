module Wired
  class BaseComponent < ActionView::Base
    attr_accessor :__id
    attr_accessor :__event_queue
    attr_accessor :__event_queue_next
    attr_accessor :__redirect_to

    def initialize(context, args)
      args.each do |k,v|
        instance_variable_set("@#{k}", v) # use @ inside component
      end

      self.__event_queue = []
      self.__event_queue_next = []

      super(context.lookup_context, state, context.controller)
    end

    def compiled_method_container
      self.class
    end

    def view(layout, locals={})
      view_renderer.render(self, { template: layout, locals: locals })
    end

    ### utility stuff

    def setId(id)
      self.__id = id
    end

    def state
      instance_values.reject{|k,v| k.in?(reserved_vars) }
    end

    ## DESERIALIZABLE JSON FORMAT FOR STATE ##
    def serialized_state
      dump = {}

      state.each{ |var, val| dump[var] = Wired::Manager.serialize(val) }

      return dump
    end

    def mount
      # noop
    end

    def redirect(url)
      self.__redirect_to = url
    end

    def redirect_to
      self.__redirect_to
    end

    def dispatch(event, data=nil)
      self.__event_queue << { event: event, data: data }
    end

    def dispatchOnNextPage(event, data=nil)
      self.__event_queue_next << { event: event, data: data }
    end

    def event_queue
      self.__event_queue
    end

    def event_queue_next
      self.__event_queue_next
    end

    ## SETS ACTUAL INSTANCE VARIABLE ##
    def updateModel(name, value)
      parts = name.split('[').map{|k| k.gsub(/['"\]]/, '').split('.')}.flatten

      if parts.size > 1 # insert nested key
        fullvalue = hashify_assign(parts, value) 
        value = fullvalue[parts[0]] # only inner key (top level == instance var)
      end

      currentVal = instance_variable_get(:"@#{parts[0]}")

      # inputs are submitted as strings most of the time, we need to type cast into what they were originally
      # TODO: help
      case currentVal.class.name
      when 'Array'
        # {array_index => value} -> [values]
        newVal = currentVal.each_with_index.map{|v, i| value[i.to_s] || v }
      when 'Integer'
        newVal = value.to_i
      when 'Float'
        newVal = value.to_f
      when 'Date'
        newVal = Date.parse(value)# rescue Date.new
      when 'DateTime', 'ActiveSupport::TimeWithZone'
        newVal = DateTime.parse(value)# rescue DateTime.new
      when 'Hash'
        newVal = currentVal.deep_merge(value.deep_symbolize_keys) rescue value
      when 'FalseClass', 'TrueClass'
        newVal = value == 'true'
      else
        newVal = value # no need to cast
      end

      instance_variable_set(:"@#{parts[0]}", newVal)
    end

    def setUpload(name, files, multiple)
      blobs = multiple ? ActiveStorage::Blob.where(key: files.map{|f| f['key']}) : ActiveStorage::Blob.find_by(key: files.first['key'])

      updateModel(name, blobs)
    end

    def prepare_response
      stateData = serialized_state
      redirectTo = redirect_to
      eventQueue = event_queue
      eventQueueNext = event_queue_next

      # TODO: find a good way to do this
      # html = redirectTo ? '<div></div>' : render_layout # dont render template if redirect
      html = render_layout

      return [stateData, redirectTo, eventQueue, eventQueueNext, html]
    end

    private

    def hashify_assign(attr_array, value)
      if attr_array.size == 1
        return [[attr_array[0], value]].to_h
      else
        return [[attr_array[0], hashify_assign(attr_array[1..-1], value)]].to_h
      end
    end

    # TODO: this is awful
    def reserved_vars
      %w[
        _config
        lookup_context
        view_renderer
        current_template
        _assigns
        _controller
        _request
        _default_form_builder
        _routes
        view_flow
        output_buffer
        virtual_path
        tag_builder
        __id
        __event_queue
        __event_queue_next
        __redirect_to
      ]
    end
  end

  # always compile template views before render
  # this because we reinitialize components to update their state
  # and that makes the already compiled view method not present for the class
  # kinda ugly maybe but it works for now
  module AlwaysCompile
    def compile!(_view)
      @compiled = false if Rails.env.development?
      super
    end
  end
  ActionView::Template.prepend(AlwaysCompile)
end
