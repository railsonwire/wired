module Wired
  module Features
    module Paginator

      def self.included(base)
        base.class_eval do
          def initialize(*args)
            # set paging vars
            @currentPage = 1
            @perPage = 10
            @size = 7
            # no override
            super(*args)
          end
        end
      end

      def update_pagination(direction)
        if direction == 'next'
          @currentPage += 1
        elsif direction == 'prev'
          @currentPage -= 1
        end
      end

      def goto_page(n)
        @currentPage = n
      end

      def reset_page
        @currentPage = 1
      end

      def paginate(items)
        @lastPage = [(items.size.to_f / @perPage).ceil, 1].max
        @pagination = series
        items.limit(@perPage).offset( (@currentPage-1)*@perPage )
      end

      private

      def series
        # https://github.com/ddnexus/pagy/blob/d76d809ebab18410f4fbe233c19fbd7b5faac1a2/gem/lib/pagy.rb#L44
        return [] if @size.zero?
        [].tap do |series|
          if @size >= @lastPage
            series.push(*1..@lastPage)
          else
            left  = ((@size - 1) / 2.0).floor                       # left half might be 1 page shorter for even size
            start = if @currentPage <= left                         # beginning pages
                      1
                    elsif @currentPage > (@lastPage - @size + left) # end pages
                      @lastPage - @size + 1
                    else                                            # intermediate pages
                      @currentPage - left
                    end
            series.push(*start...start + @size)
            # Set first and last pages plus gaps when needed, respecting the size
            if @size >= 7
              series[0]  = 1          unless series[0]  == 1
              series[1]  = :gap       unless series[1]  == 2
              series[-2] = :gap       unless series[-2] == @lastPage - 1
              series[-1] = @lastPage  unless series[-1] == @lastPage
            end
          end
          series[series.index(@currentPage)] = @currentPage.to_s
        end
      end
    end
  end
end