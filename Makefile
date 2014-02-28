all: lint test

lint: build
	@./node_modules/.bin/jshint lib/ bin/ test/ | head -n -2 ; env test $${PIPESTATUS[0]} -eq 0

test: build
	@./node_modules/.bin/mocha -i -g '#async#'

test-all: build
	@./node_modules/.bin/mocha

cov: build
	@./node_modules/.bin/_mocha  -r blanket -R html-cov |firefox "data:text/html;base64,$$(base64 -w 0 <&0)"

debug: build
	-killall  node
	node --debug-brk ./bin/netnovel.js &
	node-inspector &
	ni google-chrome http://127.0.0.1:8080/debug?port=5858

indent:
	@find bin/ lib/ test/ -type f -name '*.js' -exec ./script/indent '{}' ';'

build: precheck
	@if [[ ! -d node_modules ]]; then npm install; fi

precheck:
	@if [[ ! -f www/jquery-2.0.1.min.js ]]; then wget http://code.jquery.com/jquery-2.0.1.min.js -O - | gunzip > www/jquery-2.0.1.min.js; fi

.PHONY: all test cov debug lint indent
