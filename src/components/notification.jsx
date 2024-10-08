

const Notification = ({message,onClose}) => {

 

  return (
    <div
      className="absolute top-5 right-5" // Tailwind CSS classes for absolute positioning
      style={{
        /* Alternatively, use inline styles for absolute positioning */
        // position: "absolute",
        // top: "5px",
        right: "5px",
        zIndex: 9999, // Ensure it's above other content
      }}
    >
    
 



<div className="flex justify-between px-3 py-1 bg-white items-center gap-1 rounded-lg border border-gray-100 my-3">
  <div className="relative w-14 h-14 rounded-full hover:bg-red-700 bg-gradient-to-r from-purple-400 via-blue-500 to-red-400">
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-gray-200 rounded-full border-2 border-white">
      {message.senderId._id&&<img className="w-full h-full object-cover rounded-full" src={message.senderId?.imageUrl} alt="" />}
      {message.receiverId._id&&<img className="w-full h-full object-cover rounded-full" src={message.receiverId?.imageUrl} alt="" />}
    </div>
  </div>
  <div>
    <span className="font-mono">{message?.message}</span>
  </div>
  <div className="flex gap-2">
   
    <button className="focus:outline-none"
    onClick={onClose}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 hover:text-gray-900" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
</div>



    </div>
  );

};

export default Notification;



