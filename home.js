import filterList from './filterList.js';

const url = 'https://live.kuaishou.com/profile/';

filterList.forEach((id, index) => {
  console.log(`${index}: ${url}${id}`);
});