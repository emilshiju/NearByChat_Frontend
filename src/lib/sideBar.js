
import HomeIcon from '@mui/icons-material/Home';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import DuoIcon from '@mui/icons-material/Duo';
import SettingsIcon from '@mui/icons-material/Settings';


const Menus = [
    { title: "Home", src: "Overview",icon:HomeIcon,link:"/"},
    { title: "Profile", src: "Overview",icon:AccountCircleIcon,link:"/profile"},
    { title: "Notification", src: "Overview" ,icon:NotificationsNoneIcon,link:"/notification"},
    { title: "ChatBox", src: "Overview",icon:ChatBubbleOutlineOutlinedIcon,link:'/chatBox'},
    { title: "chatRandom", src: "Overview",icon:DuoIcon,link:'/chatRandom'},
    { title: "settings", src: "Overview",icon:SettingsIcon,link:'/settings'  },
    // { title: "chatRandom", src: "Overview",icon:DuoIcon,link:'/sample'},
    // { title: "chatRandom", src: "Overview",icon:HomeIcon,link:'/sampleChat'},
    // { title: "chatRandom", src: "Overview",icon:NotificationsNoneIcon,link:'/notificationSample'},
    // { title: "Overview", src: "Overview"  },
    // { title: "Overview", src: "Overview"  },


    ];


    export default Menus