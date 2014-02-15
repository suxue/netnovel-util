all: lint test

lint:
	@./node_modules/.bin/jshint lib/ bin/ test/ | head -n -2 ; env test $${PIPESTATUS[0]} -eq 0

test:
	@./node_modules/.bin/mocha
cov:
	@./node_modules/.bin/_mocha  -r blanket -R html-cov |firefox "data:text/html;base64,$$(base64 -w 0 <&0)"

debug:
	-killall  node
	node --debug-brk ./bin/netnovel &
	node-inspector &
	ni google-chrome http://127.0.0.1:8080/debug?port=5858

indent:
	@find bin/ lib/ test/ -type f -name '*.js' -exec ./script/indent '{}' ';'

#@echo run closure compiler ...
#@ccjs `find . -name '*.js' ` --language_in=ECMASCRIPT5_STRICT >/dev/null

.PHONY: all test cov debug lint indent
