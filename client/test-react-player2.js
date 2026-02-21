const ReactPlayer = require('react-player');
console.log(ReactPlayer.default.canPlay('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
console.log(ReactPlayer.default.canPlay('youtube.com/watch?v=dQw4w9WgXcQ'));
console.log(ReactPlayer.default.canPlay('https://youtu.be/dQw4w9WgXcQ'));
console.log(ReactPlayer.default.canPlay('invalid_url'));
