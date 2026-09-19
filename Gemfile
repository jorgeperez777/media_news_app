source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 2.6.10"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'xcodeproj', '< 1.26.0'
gem 'concurrent-ruby', '< 1.3.4'
# json 3.x removed the `quirks_mode` option that activesupport 7.2 still passes
# ("unknown keyword: quirks_mode" during pod install on Ruby 4 / Homebrew).
gem 'json', '< 3.0'
# Ruby 4 removed nkf/kconv from the default gems; CocoaPods still requires them.
gem 'nkf'
