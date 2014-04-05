all: lint test

lint: dep
	@./node_modules/.bin/jshint lib/ bin/ test/ | head -n -2 ; env test $${PIPESTATUS[0]} -eq 0

test: dep
	@./node_modules/.bin/mocha -i -g '#async#|#ASYNC#'

test-all: dep
	@npm test

cov: dep
	@npm run-script cover

debug: dep
	-killall  node
	node --debug-brk ./bin/netnovel.js &
	node-inspector &
	ni google-chrome http://127.0.0.1:8080/debug?port=5858

indent:
	@find bin/ lib/ test/ -type f -name '*.js' -exec ./script/indent '{}' ';'

dep:
	@./script/dep

.PHONY: all test cov debug lint indent
