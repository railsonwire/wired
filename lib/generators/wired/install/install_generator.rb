module Wired
  class InstallGenerator < Rails::Generators::Base

    def init
      puts("Installing JS package")
      run("yarn add https://github.com/railsonwire/wired")

      puts('Creating required folders')
      Dir.mkdir('app/components') unless Dir.exist?('app/components')
      Dir.mkdir('app/views/components') unless Dir.exist?('app/views/components')

      puts "*** FINISHED ***"
    end
  end
end