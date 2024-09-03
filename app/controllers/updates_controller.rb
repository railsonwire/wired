class UpdatesController < ApplicationController

  def update
    state = request.parameters[:state].deep_symbolize_keys
    updates = request.parameters[:updates]

    component = Wired::Manager.fromState(self.view_context, state)

    updates.each do |update|
      if update[:type] == 'syncInput'
        input = update[:data]
        model = input[:model]
        value = input[:value]

        component.updateModel(model, value)
      elsif update[:type] == 'callMethod'
        call = update[:data]
        callMethod = call[:method]
        callArgs = call[:params] || []
    
        component.send(callMethod, *callArgs)
      end
    end

    stateData, redirectTo, eventQueue, eventQueueNext, html = component.prepare_response

    render json: {
      html: html,
      redirectTo: redirectTo,
      eventQueue: eventQueue,
      eventQueueNext: eventQueueNext,
      state: {
        data: stateData,
        refs: state[:refs] # forward references from req
      }
    }
  end
end