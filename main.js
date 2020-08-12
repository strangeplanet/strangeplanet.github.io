var _username = ''
var _data = {'index':0}
var head_block = 0
var _id = 1
var _nfts = []
var nodes = [
	'https://rpc.ausbit.dev',
	'https://hive.roelandp.nl',
	'https://hived.privex.io',
	'https://api.hive.blog',
	'https://rpc.esteem.app',
	'https://techcoderx.com',
	'https://anyx.io',
	'https://api.hivekings.com',
	'http://anyx.io'
]
const colors = {
	'1':'green',
	'2':'cyan',
	'3':'blue',
	'4':'violet',
	'5':'pink',
	'6':'red'
}

function hive_customJSON(params) {
	hive_keychain.requestCustomJson(
		params['username'],
		params['id'],
		params['auth'],
		params['json'],
		params['message'],
		function(response) {
			console.log('main js response - custom JSON')
			console.log(response)
		}
	)
}

function hive_transfer(params) {
	hive_keychain.requestTransfer(
		params['username'],
		params['sendTo'],
		params['amount'],
		params['memo'],
		params['symbol'],
		function(response) {
			console.log("main js response - transfer")
			console.log(response)
		},
		!(params['enforce'] === 'false')
	)
}

function hive_broadcast(username, operations, key) {
	hive_keychain.requestBroadcast(
		username,
		operations,
		key,
		function(response) {
			console.log('main js response - broadcast')
			console.log(response)
		}
	)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function convertMinsToHrsMins(mins) {
  let h = Math.floor(mins / 60);
  let m = mins % 60;
  h = h < 10 ? '0' + h : h;
  m = m < 10 ? '0' + m : m;
  return `${h}:${m}`;
}

function next_node() {
	const old = nodes[0]
	let temp = nodes.slice(1)
	temp.push(nodes[0])
	nodes = temp
	console.log(`switching from ${old} to ${nodes[0]}`)
}

async function condenser(method, params) {
	const url = 
	j = {'jsonrpc':'2.0', 'method':`condenser_api.${method}`, 'params':params, 'id':_id}
	_id += 1
	const response = await fetch(nodes[0], {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(j)
	})
	const r = await response.json()
	if (r['result']) {
		return r['result']
	} else {
		next_node()
		return await condenser(method, params)
	}
}

async function heRPC(endpoint, method, params) {
	let url = `https://api.hive-engine.com/rpc/${endpoint}`
	j = {'jsonrpc':'2.0', 'id':_id, 'method':method, 'params':params}
	_id += 1
	const response = await fetch(url, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(j)
	})
	return response.json()
}

async function heFind(contract, table, query, limit=1000, offset=0, all=[]) {
	let params = {
		'contract':contract, 
		'table':table,
		'query':query,
		'limit':limit,
		'offset':offset,
		'indexes':[]
	}
	result = await heRPC('contracts', 'find', params)
	newData = result['result']
	all = all.concat(newData)
	return (newData.length === limit) ? await heFind(contract, table, query, limit, offset+limit, all) : all
}

async function head_block_task() {
	while (true) {
		if (_nfts.length) {
			try {
				r = await condenser('get_dynamic_global_properties', [])
				const temp = r['head_block_number']
				if (temp > head_block) {
					head_block = temp
					displayChar()
					// do some stuff
				}
			} catch (e) {
				console.log(e)
			}			
		}

		await sleep(9000)
	}
}

function groupCards(cards, size=50) {
	const arr = cards.map(a => a._id.toString())
	let result = []
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i+size))
	}
	return result
}

function makeEngineOp(jdata, account) {
	return {
		'id':'ssc-mainnet-hive',
		'json':JSON.stringify(jdata),
		'required_auths':[account],
		'required_posting_auths':[]
	}
}

function getTransferOps(groups, sender, receiver) {
	let ops = []
	let jj = []
	let len = 2
	for (let i = 0; i < groups.length; i++) {
		let j = {
			'contractName': 'nft',
			'contractAction': 'transfer',
			'contractPayload': {
				'to':receiver,
				'nfts':[{'symbol':'IDLE','ids':groups[i]}]
			}
		}
		let l = JSON.stringify(j).length + 1
		if (len + l < 8192) {
			jj.push(j)
			len += l
		} else {
			ops.push(['custom_json', makeEngineOp(jj, sender)])
			if (ops.length > 4) {
				return ops
			}
			len = 2 + l
			jj = []
		}
	}
	if ((jj.length > 0) & (ops.length < 5)) {
		ops.push(['custom_json', makeEngineOp(jj, sender)])
	}
	return ops
}

function resetAccount() {
	if (_username && _nfts.length) {
		console.log(_nfts)
		const groups = groupCards(_nfts)
		const ops = getTransferOps(groups, _username, 'strange.planet')
		hive_broadcast(_username, ops, 'Active')
	}
}

function leftButton() {
	for (const but of document.getElementsByClassName('abutton')) {
		but.setAttribute('class', 'lbutton')
	}
	this.setAttribute('class', 'abutton')
}

// TODO: item text, tooltip?, sort, buttons to transfer and sell
async function inventory() {
	while (!_nfts.length) await sleep(200)
	const mp = document.getElementById('main-panel')
	mp.style.display = 'block'
	mp.innerHTML = ''
	for (const [stack, data] of Object.entries(_data['stacks'])) {
		const [item, tier] = stack.split('_')
		const color = colors[tier]
		const aa = document.createElement('div')
		aa.setAttribute('class', 'invitem')
		aa.style.backgroundImage = `url('/images/${stack}.png')`
		const dd = document.createElement('span')
		dd.setAttribute('id', 'invq')
		dd.innerHTML = `${data['quantity']}`
		aa.appendChild(dd)
		mp.appendChild(aa)
	}
}

function addToCharDisplay(cd, text) {
	const ss = document.createElement('span')
	ss.setAttribute('id', 'cdt')
	ss.innerHTML = text
	cd.appendChild(ss)
}

function displayChar() {
	const c = _data['chars'][_data['index']]
	const cd = document.getElementById('char-display')
	cd.innerHTML = ''
	const name = c['char']['char_name']
	addToCharDisplay(cd, `name: ${name}`)
	const id = c['_id']
	addToCharDisplay(cd, `id: ${id}`)
	for (const [k, s] of Object.entries(c['skill'])) {
		addToCharDisplay(cd, `skill: ${k}`)
		addToCharDisplay(cd, `-level: ${s['level']}`)
		addToCharDisplay(cd, `-tier: ${s['tier']}`)
		addToCharDisplay(cd, `-xp: ${s['xp']}`)
		addToCharDisplay(cd, `-total xp: ${s['txp']}`)
	}
	const stamina = c['stamina']['stamina']
	const max = c['stamina']['max']
	addToCharDisplay(cd, `stamina: ${stamina}/${max}`)
	let task = c['task']['task']
	if (!task.indexOf('rest:')) task = 'rest'
	addToCharDisplay(cd, `task: ${task}`)
	const start = c['task']['start']
	addToCharDisplay(cd, `start: ${start}`)
	if (head_block) {
		const m = parseInt((head_block - c['task']['start']) / 20)
		addToCharDisplay(cd, `minutes: ${m}`)
	}
}

function showHide() {
	if (document.getElementById('show-hide').checked) {
		document.getElementById('char-display').style.visibility = 'visible'
	} else {
		document.getElementById('char-display').style.visibility = 'hidden'
	}
}

function highlightChar() {
	displayChar() //move..
	for (let i = 0; i < _data['chars'].length; i++) {
		const bb = document.getElementById(`char-${i}`)
		if (i === _data['index']) {
			bb.style.backgroundColor = 'paleturquoise'
		} else {
			bb.style.backgroundColor = 'white'
		}
	}
}

function charClick() {
	_data['index'] = parseInt(this.id.slice(this.id.indexOf('-')+1))
	highlightChar()
}

function prevChar() {
	if (_data['index'] === 0) {
		_data['index'] = _data['chars'].length - 1
	} else {
		_data['index'] = (_data['index'] - 1) % _data['chars'].length
	}
	highlightChar()
}

function nextChar() {
	_data['index'] = (_data['index'] + 1) % _data['chars'].length
	highlightChar()
}

function charList() {
	if (!_nfts.length) return
	const cp = document.getElementById('char-list')
	cp.innerHTML = ''
	for (let i = 0; i < _data['chars'].length; i++) {
		const c = _data['chars'][i]
		const id = c['_id']
		const name = c['char']['char_name']
		// let task, tier = 0
		// if (c['task']['task'].indexOf('rest:') === 0) {
			// task = 'rest'
		// } else {
			// [task, tier] = c['task']['task'].split('_')
		// }
		const dd = document.createElement('div')
		dd.setAttribute('class', 'char-box')
		dd.setAttribute('id', `char-${i}`)
		dd.addEventListener('click', charClick)
		dd.style.display = 'block'
		let ss = document.createElement('span')
		ss.setAttribute('id', 'char-attr')
		ss.innerHTML = `${name}`
		dd.appendChild(ss)
		// ss = document.createElement('span')
		// ss.setAttribute('id', 'char-attr')
		// if (tier) ss.innerHTML = `${colors[tier]} ${task}`
		// else ss.innerHTML = `${task}`
		// if (head_block) {
			// const m = parseInt((head_block - c['task']['start']) / 20)
			// ss.innerHTML += '; ' + convertMinsToHrsMins(m)
		// }
		// dd.appendChild(ss)
		cp.appendChild(dd)
	}
	highlightChar()
}

async function loadNfts(account) {
	const query = {'account':account}
	_nfts = await heFind('nft', 'IDLEinstances', query)
	if (_nfts.length) {
		let _char = {}
		const rb = document.getElementById('reset-button')
		rb.disabled = false
		rb.onclick = resetAccount
		_data['stacks'] = {}
		_data['chars'] = []
		for (const nft of _nfts) {
			const name = nft['properties']['name']
			const data = JSON.parse(nft['properties']['a'])
			if (name === '_CHARACTER_') {
				_char[nft['_id']] = {'char':data}
				_char[nft['_id']]['skill'] = {}
			} else if (name === '_TASK_') {
				_char[data['char_id']]['task'] = data
			} else if (name === '_SKILL_') {
				_char[data['char_id']]['skill'][data['skill']] = data
			} else if (name === '_STAMINA_') {
				_char[data['char_id']]['stamina'] = data
			} else if (name === '_STAMINA_TASK_') {
				_char[data['char_id']]['stamina_task'] = data
			} else if (name === '_STACK_') {
				_data['stacks'][data['item']] = data
			}
		}
		for (const [id, ch] of Object.entries(_char)) {
			ch['_id'] = id
			_data['chars'].push(ch)
		}
		console.log(_data)
		document.getElementById('char-prev').onclick = prevChar
		document.getElementById('char-next').onclick = nextChar
		document.getElementById('show-hide').onclick = showHide
		charList()
	}
}

function nameInput(event) {
	const ni = document.getElementById('name-input')
	ni.value = ni.value.slice(0, 16)
}

function createAccount() {
	if (_username) {
		const ni = document.getElementById('name-input')
		memo = JSON.stringify({'action':'new_char', 'char_name':ni.value})
		hive_keychain.requestTransfer(
			_username,
			'strange.planet',
			0.001,
			memo,
			'HIVE',
			function(response) {
				console.log('createAccount - transfer')
				console.log(response)
				if (response.success) {
					setTimeout(function(){location.reload()}, 12000)
				}
			},
			'false'
		)
	} else {
		newAccount()
	}
}

function newAccount() {
	const mp = document.getElementById('main-panel')
	mp.innerHTML = ''
	mp.style.display = 'flex'
	mp.style.justifyContent = 'center'
	mp.style.alignItems = 'center'
	if (_username) {
		const la = document.createElement('label')
		la.innerHTML = 'Character Name:'
		mp.appendChild(la)
		const ni = document.createElement('input')
		ni.setAttribute('id', 'name-input')
		ni.addEventListener('input', nameInput)
		mp.appendChild(ni)
		const cb = document.createElement('button')
		cb.setAttribute('id', 'create-button')
		cb.onclick = createAccount
		mp.appendChild(cb)
	} else {
		const t = document.createTextNode('Please log in to create a new account.')
		mp.appendChild(t)
	}
}

function skillTask() {
	if (_username && _nfts.length) {
		const id = this.id
		const [skill, tier] = id.split('_')
		data = {
			'action':'start_task',
			'char_id':_data['chars'][_data['index']]['_id'],
			'task':`${skill}_${tier}`
		}
		hive_keychain.requestCustomJson(
			_username,
			'strangeplanet',
			'Active',
			JSON.stringify(data),
			`Start ${skill} Task`,
			function(response) {
				console.log('main js response - custom JSON')
				console.log(response)
			}
		)		
	}
}

function skillPortal() {
	if (_username && _nfts.length) {
		const mp = document.getElementById('main-panel')
		mp.innerHTML = ''
		const id = this.id
		const skill = id.slice(0, id.indexOf('-'))
		const skills = _data['chars'][_data['index']]['skill']
		for (let i = 1; i <= 6; i++) {
			let tier = 1
			if (skill in skills) tier = skills[skill]['tier']
			const bb = document.createElement('button')
			bb.innerHTML = `${colors[i]} ${skill}`
			bb.setAttribute('class', 'skill-button')
			bb.setAttribute('id', `${skill}_${tier}`)
			bb.onclick = skillTask
			bb.style.backgroundColor = colors[i]
			bb.disabled = (i > tier)
			mp.appendChild(bb)
		}
	}
}

function charScreen() {
	const mp = document.getElementById('main-panel')
	mp.innerHTML = 'heyo'
}

// TODO: back button, title bar
function mainScreen() {
	if (_username) {
		const mp = document.getElementById('main-panel')
		mp.style.display = 'block'
		mp.innerHTML = ''
		const tp = document.createElement('button')
		tp.setAttribute('class', 'portal-button')
		tp.setAttribute('id', 'trees-button')
		tp.onclick = skillPortal
		mp.appendChild(tp)
		const rp = document.createElement('button')
		rp.setAttribute('class', 'portal-button')
		rp.setAttribute('id', 'rocks-button')
		rp.onclick = skillPortal
		mp.appendChild(rp)
		const sp = document.createElement('button')
		sp.setAttribute('class', 'portal-button')
		sp.setAttribute('id', 'spiders-button')
		sp.onclick = skillPortal
		mp.appendChild(sp)		
	}
}

function loggedIn() {
	return localStorage.getItem('username')
}

function enterLogin(event) {
	if ((event.key === 'Enter') && (!loggedIn())) {
		login()
	}
}

function login() {
	if (loggedIn()) {
		_username = ''
		_nfts = []
		localStorage.removeItem('username')
		document.getElementById('login-input').value = ''
		document.getElementById('login-button').style.backgroundImage = "url('/images/login-button.png')"
		location.reload()
	} else {
		let username = document.getElementById('login-input').value
		if (window.hive_keychain) {
			hive_keychain.requestSignBuffer(username, `${username}${Date.now()}`, 'Posting', function(response) {
				if (response.error) {
					console.log(username + ' login error')
				} else {
					localStorage.setItem('username', username)
					location.reload()
					// document.getElementById('login-button').style.backgroundImage = "url('/images/logout-button.png')"
				}
			})
		}
	}
}

function test() {
	document.getElementById('char-button').click()
}

async function setup() {
	for (const but of document.getElementsByClassName('lbutton')) {
		but.addEventListener('click', leftButton)
	}
	document.getElementById('login-input').addEventListener('keyup', enterLogin)
	document.getElementById('login-button').onclick = login
	document.getElementById('main-button').onclick = mainScreen
	document.getElementById('char-button').onclick = charScreen
	document.getElementById('char-button2').onclick = test
	document.getElementById('inventory-button').onclick = inventory
	document.getElementById('newaccount-button').onclick = newAccount
	username = loggedIn()
	if (username) {
		document.getElementById('login-input').value = username
		document.getElementById('login-button').style.backgroundImage = "url('/images/logout-button.png')"
		document.body.style.cursor = 'wait'
		await loadNfts(username)
		document.body.style.cursor = 'auto'
		_username = username
	}
}

window.addEventListener('load', async function () {
	await setup()
	mainScreen()
	head_block_task()
})