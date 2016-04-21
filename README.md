<!--
@Author: Vargas Hector <vargash1>
@Date:   Saturday, March 19th 2016, 9:53:23 pm
@Email:  vargash1@wit.edu
@Last modified by:   vargash1
@Last modified time: Sunday, April 3rd 2016, 6:11:33 pm
-->

#vTodo
This Project is a Task keeping application that has both a Web GUI and a CLI interface. Its written in NodeJS, I essentially made a mimic of Google Keep. 
The user is allowed to change the task color, delete tasks, add tasks, modify tasks, and change their settings(email, password). The CLI port only offers task modification, task deletion, and 
task additions. Its web UI was implemented using boostrap. 

###Usage
```bash
git clone  https://github.com/vargash1/vTodo.git
node bin/www | bunyan & 
```

Will run at [port 3000 on localhost](http://localhost:3000/users)


###Screenshots

<p align="center">
   <img src="http://i.imgur.com /uytOL1a.png?1" alt="UI Screenshot"> <br>
   <img src="http://i.imgur.com/758fcB2.png?1" alt="Modifying a Task"> <br>
   <img src="http://i.imgur.com/M4E4F7E.png?1" alt="Changing Task Color"> <br>
   <img src="http://i.imgur.com/qhq5O46.png" alt="Deleting a Task"> <br>
   <img src="http://i.imgur.com/QwzV5KN.png?1" alt="Adding a Task"> <br>
   <img src="http://i.imgur.com/G8OOURi.png?1" alt="Sign up"> <br>
   <img src="http://i.imgur.com/o9YzXpJ.png?1" alt="Log In"> <br>
   <img src="http://i.imgur.com/8qElff3.png?1" alt="Dropdown Nav Bar 1"> <br>
   <img src="http://i.imgur.com/MHgDaI6.png?1" alt="Dropdown Nav Bar 2"> <br>
   
</p>

###CLI
This project has a CLI client, here is the [Github Repo](https://github.com/vargash1/vTodoCLI) 
