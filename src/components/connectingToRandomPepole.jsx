import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import { useSelector, useDispatch } from "react-redux";
import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../context/socket';
import { FiVideo, FiVideoOff, FiMic, FiMicOff } from "react-icons/fi";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhone, FaTimes } from 'react-icons/fa';

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]
    }
  ]
};

const ConnectingToRandomPeople = () => {
  const userId = useSelector(state => state.user.id);
  const [change, setChange] = useState(false);
  const [isCallStarted, setCallStarted] = useState(false);
  const [isAudioMuted, setAudioMuted] = useState(false);
  const [isVideoMuted, setVideoMuted] = useState(false);
  const [allMessage, setAllMessage] = useState([]);

  const localStream = useRef(null);
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(null);
  const receiver = useRef(null);

  const startB = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true },
      });
      localVideo.current.srcObject = localStream.current;
      setCallStarted(true);
    } catch (err) {
      console.log('Error accessing media devices:', err);
    }
  };

  const handleComponetChange = () => {
    setChange(false);

    if (receiver.current) {
      socket.emit("randomConnectionComponentChangeBothClearing", {
        userId,
        receiver: receiver.current,
      });
    } else {
      socket.emit("randomConnectionComponentChangeCurrentClearing", { userId });
    }

    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }

    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;

    if (remoteVideo.current?.srcObject) {
      remoteVideo.current.srcObject = null;
    }
    receiver.current = null;
  };

  useEffect(() => {
    startB();

    socket.on('ready', (current, opposite) => {
      setChange(true);
      receiver.current = opposite;
      console.log('Received opposite user ID:', opposite);
    });

    socket.on('readys', (current, opposite) => {
      setChange(true);
      receiver.current = opposite;
      socket.emit("randomVideoConnection", { id: opposite, type: "ready" });
    });

    socket.on('randomVideoConnection', (e) => {
      if (!localStream.current) {
        console.log("Not ready yet");
        return;
      }
      switch (e.type) {
        case "offer":
          handleOffer(e);
          break;
        case "answer":
          handleAnswer(e);
          break;
        case "candidate":
          handleCandidate(e);
          break;
        case "skipped":
          handleOppositeSkip();
          break;
        case "ready":
          if (pc.current) {
            console.log("Already in call, ignoring");
            return;
          }
          makeCall();
          break;
        case "bye":
          if (pc.current) {
            hangup();
          }
          break;
        default:
          console.log("Unhandled event:", e);
          break;
      }
    });

    socket.on('randomChatMessage', (res) => {
      const { userId, receiver, message } = res;
      setAllMessage((prev) => [...prev, res]);
    });

    socket.on('skippedRemoved', () => {
      handleOppositeSkip();
      socket.emit('readyToChat', userId);
    });

    return () => {
      handleComponetChange();
      socket.off('randomVideoConnection');
      socket.off('randomChatMessage');
      socket.off('skippedRemoved');
      socket.off('ready');
      socket.off('readys');
    };
  }, []);

  async function makeCall() {
    if (!receiver.current) {
      console.error("Receiver not set");
      return;
    }
    try {
      pc.current = new RTCPeerConnection(configuration);
      pc.current.onicecandidate = (e) => {
        const message = {
          type: "candidate",
          candidate: null,
          id: receiver.current,
        };
        if (e.candidate) {
          message.candidate = e.candidate.candidate;
          message.sdpMid = e.candidate.sdpMid;
          message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        socket.emit("randomVideoConnection", message);
      };
      pc.current.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
      localStream.current.getTracks().forEach((track) =>
        pc.current.addTrack(track, localStream.current)
      );
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit("randomVideoConnection", {
        id: receiver.current,
        type: "offer",
        sdp: offer.sdp,
      });
    } catch (e) {
      console.log(e);
    }
  }

  async function handleOffer(offer) {
    if (pc.current) {
      console.error("Existing PeerConnection found, not handling offer");
      return;
    }
    try {
      pc.current = new RTCPeerConnection(configuration);
      pc.current.onicecandidate = (e) => {
        const message = {
          type: "candidate",
          id: receiver.current,
          candidate: null,
        };
        if (e.candidate) {
          message.candidate = e.candidate.candidate;
          message.sdpMid = e.candidate.sdpMid;
          message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        socket.emit("randomVideoConnection", message);
      };
      pc.current.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
      localStream.current.getTracks().forEach((track) =>
        pc.current.addTrack(track, localStream.current)
      );
      await pc.current.setRemoteDescription(offer);

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      socket.emit("randomVideoConnection", {
        id: receiver.current,
        type: "answer",
        sdp: answer.sdp,
      });
    } catch (e) {
      console.log(e);
    }
  }

  async function handleAnswer(answer) {
    if (!pc.current) {
      console.error("No PeerConnection found");
      return;
    }
    try {
      await pc.current.setRemoteDescription(answer);
    } catch (e) {
      console.log(e);
    }
  }

  async function handleCandidate(candidate) {
    if (!pc.current) {
      console.error("No PeerConnection found");
      return;
    }
    try {
      await pc.current.addIceCandidate(candidate || null);
    } catch (e) {
      console.log(e);
    }
  }

  const hangB = async () => {
    Swal.fire({
      title: 'Are you sure you want to hang up?',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    }).then((res) => {
      if (res.isConfirmed) {
        hangup();
        socket.emit("randomVideoConnection", { id: receiver.current, type: "bye" });
        setCallStarted(false);
      }
    });
  };

  async function hangup() {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    localStream.current.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    setCallStarted(false);
  }

  const handleMuteAudio = () => {
    const enabled = localStream.current.getAudioTracks()[0].enabled;
    if (enabled) {
      localStream.current.getAudioTracks()[0].enabled = false;
      setAudioMuted(true);
    } else {
      localStream.current.getAudioTracks()[0].enabled = true;
      setAudioMuted(false);
    }
  };

  const handleMuteVideo = () => {
    const enabled = localStream.current.getVideoTracks()[0].enabled;
    if (enabled) {
      localStream.current.getVideoTracks()[0].enabled = false;
      setVideoMuted(true);
    } else {
      localStream.current.getVideoTracks()[0].enabled = true;
      setVideoMuted(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-100">
      <div className="flex flex-row justify-center items-center">
        <video ref={localVideo} autoPlay playsInline muted className="w-1/3 h-auto" />
        <video ref={remoteVideo} autoPlay playsInline className="w-1/3 h-auto" />
      </div>
      <div className="mt-4">
        <button
          onClick={hangB}
          className="bg-red-500 text-white p-2 m-2 rounded-full"
          disabled={!isCallStarted}
        >
          <FaPhone />
        </button>
        <button
          onClick={handleMuteAudio}
          className="bg-gray-500 text-white p-2 m-2 rounded-full"
          disabled={!isCallStarted}
        >
          {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>
        <button
          onClick={handleMuteVideo}
          className="bg-gray-500 text-white p-2 m-2 rounded-full"
          disabled={!isCallStarted}
        >
          {isVideoMuted ? <FaVideoSlash /> : <FaVideo />}
        </button>
      </div>
    </div>
  );
};

export default ConnectingToRandomPeople;























































// backup backup backup backup backup backup backup 


// import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
// import { useSelector ,useDispatch} from "react-redux";
// import  React,{ useEffect,useRef,useState } from 'react';
// import { socket } from '../context/socket';
// import { FiVideo, FiVideoOff, FiMic, FiMicOff } from "react-icons/fi";

// import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhone, FaTimes, } from 'react-icons/fa';



// const configuration = {
//   iceServers: [
//     {
//       urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
//     },
//   ],
//   iceCandidatePoolSize: 10,
// };


// const ConnectingToRandomPepole = () => {

//   const userInfo = useSelector((state) => state.auth.userInfo);
//   const userId=userInfo._id
 
 
//   const receiver=useRef(null)

      
//   if(receiver){
   

//   }





//   let pc=useRef(null)
//   let localStream=useRef(null)
//   let startButton = useRef(null);
//   let hangupButton = useRef(null);
//   let muteAudButton = useRef(null);
//   let localVideo = useRef(null);
//   let remoteVideo = useRef(null);
//   let muteVideoButton=useRef(null);
//   let muteVideo=useRef(null)
//   let timer=useRef(null)





   
  

 

// useEffect(()=>{
// socket.emit('on',userInfo._id)






// return ()=>{
// socket.off('on')

// }
// },[])





  
// socket.on("randomVideoConnection", (e) => {
//   if (!localStream.current) {
//     console.log("not ready yet");
//     return;
//   }
//   switch (e.type) {
//     case "offer":
//       handleOffer(e);
//       break;
//     case "answer":
//       handleAnswer(e);
//       break;
//     case "candidate":
//       handleCandidate(e);
//       break;
//      case  "skipped":
//       handleOppositeSkip()
//       break;
//     case "ready":
//       // A second tab joined. This tab will initiate a call unless in a call already.
//       if (pc.current) {
//         // alert("already in call ignoreing")
//         console.log(pc.current)
//         console.log("already in call, ignoring");
//         return;
//       }
//       makeCall();
//       break;
//     case "bye":
//       if (pc.current) {
//         hangup();
//       }
//       break;
//     default:
//       console.log("unhandled", e);
//       break;
//   }
// });

// {console.log("component chage ")}
// {console.log(receiver.current)}



// async function makeCall() {

 

//   console.log("Amm rady ready reayd ")
//   console.log("rdddddddd why not herere ")
//   console.log(receiver.current)
//   console.log("finishi")
    
//   try {
//     pc.current = new RTCPeerConnection(configuration);
//     console.log("2")
//     pc.current.onicecandidate = (e) => {
//       const message = {
//         type: "candidate",
//         candidate: null,
//         id:receiver.current,
//       };
//       console.log("3")
//       if (e.candidate) {
//         message.candidate = e.candidate.candidate;
//         message.sdpMid = e.candidate.sdpMid;
//         message.sdpMLineIndex = e.candidate.sdpMLineIndex;
//       }
//       console.log("4")
//       socket.emit("randomVideoConnection", message);
//     };
//     console.log("5")
//     pc.current.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
//     localStream.current.getTracks().forEach((track) => pc.current.addTrack(track, localStream.current));
//     const offer = await pc.current.createOffer();
//     socket.emit("randomVideoConnection", {id:receiver.current, type: "offer", sdp: offer.sdp });
//     await pc.current.setLocalDescription(offer);
//   } catch (e) {
//     console.log(e);
//   }
// }



// async function handleOffer(offer) {
//   if (pc.current) {
//     console.error("existing peerconnection");
//     return;
//   }
//   try {
//     pc.current = new RTCPeerConnection(configuration);
//     pc.current.onicecandidate = (e) => {
//       const message = {
//         type: "candidate",
//         id:receiver.current,
//         candidate: null,
//       };
//       if (e.candidate) {
//         message.candidate = e.candidate.candidate;
//         message.sdpMid = e.candidate.sdpMid;
//         message.sdpMLineIndex = e.candidate.sdpMLineIndex;
//       }
//       socket.emit("randomVideoConnection", message);
//     };
//     pc.current.ontrack = (e) => (remoteVideo.current.srcObject = e.streams[0]);
//     localStream.current.getTracks().forEach((track) => pc.current.addTrack(track, localStream.current));
//     await pc.current.setRemoteDescription(offer);

//     const answer = await pc.current.createAnswer();
//     socket.emit("randomVideoConnection", {id:receiver.current, type: "answer", sdp: answer.sdp });
//     await pc.current.setLocalDescription(answer);
//   } catch (e) {
//     console.log(e);
//   }
// }


// async function handleAnswer(answer) {

//   console.log("answerrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr")
//   if (!pc.current) {
//     console.error("no peerconnection");
//     return;
//   }
//   try {
//     await pc.current.setRemoteDescription(answer);
//   } catch (e) {
//     console.log(e);
//   }
// }

// async function handleCandidate(candidate) {
//   try {
   
//     if (!pc.current) {
//       console.error("no peerconnection");
//       return;
//     }
 
//     if (!candidate) {
     
//       await pc.current.addIceCandidate(null);
//     } else {
    
//       await pc.current.addIceCandidate(candidate);
    
//     }

    
//   } catch (e) {
//     console.log(e);
//   }
// }




// async function hangup() {
//   if (pc.current) {
//     pc.current.close();
//     pc.current = null;
//   }
//   localStream.current.getTracks().forEach((track) => track.stop());
//   localStream.current = null;
//   startButton.current.disabled = false;
//   hangupButton.current.disabled = true;
//   muteAudButton.current.disabled = true;

//   // closeVideoCall()
  


// }




 
  
//   useEffect(() => {
//     hangupButton.current.disabled = true;
//     muteAudButton.current.disabled = true;
//     muteVideo.current.disabled=true
//   }, []);

//   const [audiostate, setAudio] = useState(true);
//   const [videoState,setVideoState]=useState(true)


//   const call=async()=>{

  


//     socket.emit("randomVideoConnection", {id:receiver.current, type: "ready" });

//   }





//   const startB = async () => {

//     try {
//       localStream.current = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: { echoCancellation: true },
//       });
//       localVideo.current.srcObject = localStream.current;
//     } catch (err) {
//       console.log(err);
//     }

//     // startButton.current.disabled = true;
//     hangupButton.current.disabled = false;
//     muteAudButton.current.disabled = false;
//     muteVideo.current.disabled=false
//      console.log("used ready ready ready ready ready ready ")
//     console.log("receiver id  ind iellyooo aryila ivideeee")
//      console.log(receiver.current)
    
    
 
//         //  socket.emit("randomVideoConnection", {id:receiver.current, type: "ready" });
    
//   };





//   const hangB = async () => {

//     Swal.fire({
//       title: 'Are you sure to  correct!',
//       showCancelButton: true,
//       confirmButtonText: 'Yes',
//       cancelButtonText: 'No'
//     }).then((res)=>{

//       if(res.isConfirmed){
//         hangup();
      
//         socket.emit("randomVideoConnection", { id:receiver.current,type: "bye" });
//       }

//     })
   

   
//   };


//   function muteAudio() {
//     if (localStream.current) {
//         localStream.current.getAudioTracks().forEach(track => {
         
//             track.enabled = !track.enabled; // Toggle mute/unmute
//         });
//         setAudio(!audiostate); // Update state for UI toggle
//     }
// }

//      function pauseVideo(){

//       if (localStream.current) {
//         localStream.current.getVideoTracks().forEach(track => {
//           track.enabled = !track.enabled; // Toggle video track
//         });
//         setVideoState(!videoState); // Update state for UI toggle
//       }

//        }


      


//     const handleOppositeSkip=()=>{

//       // setIsLoading(false)

//       if(remoteVideo.current.srcObject){

//       remoteVideo.current.srcObject=null
//       }
//       // remoteVideo.current=null
//       receiver.current=null
    
     
      
//        console.log("clearning    cccccccccccccccccccccccccccllllllllllllllllllllllllllllllllllllllllllleeeeeeeeeeeeeeeeee             clearing clearing        ")
      
//        if (pc.current) {
//         pc.current.close();
//         pc.current = null;
//       }
      
//        if(allMessage.length>0){
//         setAllMessage([])
//        }
      
//       // findingNextOne()
//       console.log("curent pcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
//       console.log(pc.current)

      
    
//       // socket.emit('readyToChat',userId)

//     }



//     const handleSkip=()=>{
//       // setIsLoading(false)

// //       remoteVideo.current=null

// // if (pc.current) {
// //   pc.current.close();
// //   pc.current = null;
// // }

//       socket.emit("removeUsersArray",{userId,receiver:receiver.current})


//     }





//     socket.on("skippedRemoved",()=>{
//       console.log("clearning    cccccccccccccccccccccccccccllllllllllllllllllllllllllllllllllllllllllleeeeeeeeeeeeeeeeee             clearing clearing        ")

 
//       if (pc.current) {
//         pc.current.close();
//         pc.current = null;
//       }
//         console.log("curent pcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
//         console.log(pc.current)
      
//         if(allMessage.length>0){

//                setAllMessage([])
//         }

      
//       socket.emit("randomVideoConnection",{id:receiver.current,type:"skipped"})

      
//       receiver.current=null

//       if(remoteVideo?.current?.srcObject){
//       remoteVideo.current.srcObject=null
//       }
  

    
      
      
//       socket.emit('readyToChat',userId)


//       // findingNextOne()

//     })




//     useEffect(()=>{

//       startB()
     
//       // socket.emit('readyToChat',userId)
    
  
     
 

//       socket.on('ready',(current,opposite)=>{


        
//                    console.log("random detailssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss")
                 
//                  console.log("before loading ")
//                  console.log(pc.current)
                 
             
//                  console.log("aftger loading")
//                  console.log(pc.current)
//                 //  if (pc.current) {
//                 //   pc.current.close();
//                 //   pc.current = null;
//                 // }

     
//         console.log("got oppositeuserID 0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")
//        receiver.current=opposite

//        console.log(current)
//        console.log(opposite)
    
         
//               console.log("emiteddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")

              
            
//       })


//       socket.on('readys',(current,opposite)=>{
       
   
//           console.log("got oppositeuserID 0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")
//          receiver.current=opposite
  
//          console.log(current)
//          console.log(opposite)
   

           
//                 console.log("emiteddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
 
          
//                 socket.emit("randomVideoConnection", {id:opposite, type: "ready" });
                    
                
              
//         })

      
//    return ()=>{

//     socket.off('readys')
//     socket.off('ready')
   
//    }

//     },[])





//     const [currentMessage,setCurrentMessage]=useState('')

  
//     const onSendMessage=()=>{

    
//      if(receiver.current){
      
//      socket.emit("randomChatMessage",{userId,receiver:receiver.current,message:currentMessage})

//      setCurrentMessage('')

//     }

//     }

    


//  const onChagneCurrentMessage=(e)=>{

//  const val=e.target.value

//  setCurrentMessage(val)



// }

// const [allMessage,setAllMessage]=useState([])




// useEffect(()=>{

//   socket.on('randomChatMessage',(res)=>{

//     const {userId,receiver,message}=res
    
//     console.log("current messagegggggggggggggggg vanuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu")
//     console.log(res)
//    setAllMessage(prev  =>  [...allMessage,res])
//   })
// },[allMessage])



// const handleKeyDown = (e) => {

//   if(currentMessage.length>0){
//   if (e.key === 'Enter') {
//      onSendMessage()
//   }
// }
// };
  

// const handleComponetChange=()=>{


//   socket.emit("randomVideoConnection",{id:receiver.current,type:"skipped"})

  

//   if (pc.current) {
//     pc.current.close();
//     pc.current = null;
//   }

//   localStream?.current?.getTracks().forEach((track) => track.stop());
//   localStream.current = null;



//   // startButton.current.disabled = false;
//   // hangupButton.current.disabled = true;
//   // muteAudButton.current.disabled = true;


//   if(receiver.current){
//   socket.emit("randomConnectionComponentChangeBothClearing",{userId,receiver:receiver.current})
//   }else{
//     socket.emit('randomConnectionComponentChangeCurrentClearing',{userId})
    
//   }

//   if(receiver?.current){
//     receiver.current=null
//   }
//   if(remoteVideo?.current?.srcObject){
//     remoteVideo.current.srcObject=null
//   }


// }
     





// useEffect(()=>{
  
//   if(receiver?.current){
//     receiver.current=null
//   }
//   if(remoteVideo?.current?.srcObject){
//     remoteVideo.current.srcObject=null
//   }

//   if (pc.current) {
//     pc.current.close();
//     pc.current = null;
//   }


//   return ()=>{

//     handleComponetChange()

//     socket.off('randomVideoConnection')
//     socket.off('randomChatMessage')
//     socket.off('skippedRemoved')

//   }
// },[])

    
//   return (
//     <div className="flex position:fixed ">
//     <div className="mr-5 mt-5 ml-5 position:fixed ">
//       <div className="bg-gray-200 h-[330px] w-[600px] rounded-lg shadow-md">
       
     

//       <video className="w-full h-full rounded-lg object-cover" ref={remoteVideo} autoPlay playsInline></video>
//       </div>
//       <br></br>
//       <div className="bg-gray-200 h-[330px] w-[600px] rounded-lg shadow-md">
//         <video className="w-full h-full rounded-lg object-cover" ref={localVideo} autoPlay playsInline></video>
//       </div>
//     </div>
  
//     <div className=" absolute flex justify-center items-center mt-4 mb-4 ml-[200px]" style={{paddingTop:"650px"}}>
//         <div className="flex space-x-4">
//           <button className="p-2 rounded-full bg-gray-300 hover:bg-gray-400" ref={muteAudButton}
//             onClick={muteAudio}>
//                 {audiostate ? <FiMic /> : <FiMicOff />}
            
//           </button>
//           <button className="p-2 rounded-full bg-gray-300 hover:bg-gray-400"  ref={startButton}
//             onClick={call}>
//             <FaPhone  className="text-gray-600" />
//           </button>
//           <button className="p-2 rounded-full bg-gray-300 hover:bg-gray-400" ref={muteVideo}
//           onClick={pauseVideo}>
//             {videoState?  <FaVideo className="text-gray-600" />:<FaVideoSlash className="text-gray-600" />}
           
//           </button>
//           <button className="p-2 rounded-full bg-gray-300 hover:bg-gray-400"      ref={hangupButton}
//             onClick={hangB} >
//             <FaTimes className="text-gray-600" />
//           </button>
//         </div>
//       </div>


//     <div className="ml-0">




//        <div className='mt-5'>

//        {/* <button
              
//               className="bg-red-600 ml-2 text-white text-2xl   px-10 py-2 rounded  "
              
//             >
//               Connect  
//             </button> */}

//       <button class="bg-sky-500 ml-2 text-white text-3xl   px-10 py-2 rounded"  onClick={handleSkip}>
//        Next <PlayCircleFilledWhiteIcon  style={{ fontSize: 28 }}  />
//      </button>


// <br></br>
// <br></br>
// </div>





// <div className='flex'>

// <div className="bg-white p-4 rounded shadow-lg relative" style={{ width: "860px", height: "550px",overflowY: "auto" }}>
//     <br></br>
  
    
//     {allMessage&&allMessage.map((a,b)=>{


//   return (
//     <div>  
//     {a.userId!==userId&&<div className='flex justify-start mb-2 pl-4'>
//     <h1>{a.message}</h1>
   
//     </div>}

//     {a.userId==userId&&<div className='flex justify-end mb-2 pr-8'>
//     <h1>{a.message}</h1>
 
//     </div>}
   

//     </div>

// )})}



    
// </div>



// <div className=" z-50 flex mx-4 px-4  mt-3 ml-[630px]" style={{ position: "absolute", bottom: "20px", left: "0", right: "0" }}>
//     <input className=" w-full h-[50px] border border-blue-400 bg-white border-opacity-40 rounded px-3 py-2 bg-grey-lighter outline-none " type="text" value={currentMessage}  onChange={onChagneCurrentMessage}  onKeyDown={handleKeyDown} placeholder="Enter text..." />
//     <svg className=" mt-3 absolute ml-[755px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="34">
//       <path opacity=".45" fill="#263238" d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"></path>
//     </svg>

//     <div className='pl-1'  onClick={onSendMessage} >
//       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="54"  style={{ cursor:receiver.current? 'pointer' : 'not-allowed' }}  >
//         <path d="M3.4,20.2,4.9,14,13.5,12,4.9,10,3.4,3.8a1,1,0,0,1,1.4-1.1L21.1,10.4a1,1,0,0,1,0,1.8L4.8,21.3A1,1,0,0,1,3.4,20.2Z" fill="#263238"/>
//       </svg>
//       </div>


//   </div> 
// </div>





//   {/* <div className="z-50 flex mx-4 px-4 mt-[0px]">
//     <input className="w-[750px] h-[50px] border border-blue-400 bg-white border-opacity-40 rounded px-3 py-2 bg-white outline-none" type="text" placeholder="Enter text..." />
//     <svg className="mt-3 absolute ml-[615px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="34">
//         <path opacity=".45" fill="#ffffff" d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"></path>
//     </svg>

//     <div className='pl-1'>
//         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="54">
//             <path d="M3.4,20.2,4.9,14,13.5,12,4.9,10,3.4,3.8a1,1,0,0,1,1.4-1.1L21.1,10.4a1,1,0,0,1,0,1.8L4.8,21.3A1,1,0,0,1,3.4,20.2Z" fill="#ffffff"/>
//         </svg>
//     </div>
// </div> */}


        




//     </div>
//   </div>
  
//   );
// };

// export default ConnectingToRandomPepole;