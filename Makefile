all: lint test

lint: build
	@./node_modules/.bin/jshint lib/ bin/ test/ | head -n -2 ; env test $${PIPESTATUS[0]} -eq 0

test: build
	@./node_modules/.bin/mocha -i -g '#async#'

alltest: build
	@./node_modules/.bin/mocha

cov: build
	@./node_modules/.bin/_mocha  -r blanket -R html-cov |firefox "data:text/html;base64,$$(base64 -w 0 <&0)"

debug: build
	-killall  node
	node --debug-brk ./bin/netnovel &
	node-inspector &
	ni google-chrome http://127.0.0.1:8080/debug?port=5858

indent:
	@find bin/ lib/ test/ -type f -name '*.js' -exec ./script/indent '{}' ';'

build:
	@if [[ ! -d node_modules ]]; then npm install; fi

.PHONY: all test cov debug lint indent
