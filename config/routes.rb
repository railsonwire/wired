Rails.application.routes.draw do
  post '/wired/:name/update', to: 'updates#update'
end
