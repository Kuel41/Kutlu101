const fs = require('fs');
let content = fs.readFileSync('src/OnlineApp.tsx', 'utf8');

content = content.replace(
  /newSocket\.on\('roomUpdate', \(players\) => \{[\s\S]*?\}\);/m,
  "newSocket.on('roomUpdate', (players) => {\n      setRoomPlayers(players);\n      const me = players.find((p: any) => p.socketId === newSocket.id);\n      if (me) {\n        setMyGamePlayerId(me.gamePlayerId);\n      }\n    });"
);

content = content.replace(
  /\}, \[username, myGamePlayerId\]\);/,
  "}, []);"
);

fs.writeFileSync('src/OnlineApp.tsx', content, 'utf8');
