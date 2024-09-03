module Wired
  class NewGenerator < Rails::Generators::NamedBase
    source_root File.expand_path("./tpl", __dir__)

    def make_new
      className = name.camelize
      lowerName = name.underscore
      copy_file "ruby.rb.tt", "app/components/#{lowerName}_component.rb"
      copy_file "html.html.erb", "app/views/components/#{lowerName}.html.erb"

      ["app/components/#{lowerName}_component.rb",
        "app/views/components/#{lowerName}.html.erb"
      ].each do |f|
        gsub_file(f, '%{name}', className)
        gsub_file(f, '%{lower}', lowerName)
      end

      puts "Done!"
    end
  end
end