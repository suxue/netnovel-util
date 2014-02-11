test:
	@mocha
cov:
	_mocha  -r blanket -R html-cov |firefox "data:text/html;base64,$$(base64 -w 0 <&0)"

debug:
	-killall  node
	node --debug-brk ./bin/netnovel &
	node-inspector &
	ni google-chrome http://127.0.0.1:8080/debug?port=5858

.PHONY: test
