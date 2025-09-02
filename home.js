const filterList = require('./filterList.js')

const url = 'https://live.kuaishou.com/profile/'

filterList.map((id, index) => console.log(index + ': ' + url + id))