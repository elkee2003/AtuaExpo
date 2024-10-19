import { StyleSheet, } from 'react-native'


const styles = StyleSheet.create({
    container:{
        marginTop:40,
        marginHorizontal:10,
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        margin: 10,
    },
    bckBtnCon:{
        position:'absolute',
        top:10,
    },
    bckBtnIcon:{
        fontSize:30,
        color:'black'
    },
    editBtn:{
        position:'absolute',
        right:10,
        top:10,
    },
    editBtnTxt:{
        color:'red',
        fontSize:17,
    },
    profilePicContainer:{
        position:'relative',
        height:150,
        width:150,
        borderRadius:75,
        backgroundColor:'#a2a2a8',
        justifyContent:'center',
        alignSelf:'center',
        justifyContent:'center',
        alignItems:'center',
        marginVertical:10,
    },
    img:{
        width:'100%',
        height:'100%',
        resizeMode:"contain",
        borderRadius:75,
    },
    plusIconContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -30 }, { translateY: -30 }], // Adjust translate values according to your icon size
        zIndex: 3,
    },
    plusIcon:{
        color: 'rgba(3, 3, 59, 0.7)',
        backgroundColor:'transparent',
        fontSize:60,
        color:'#07a830',
    },
    doneBtn:{
        backgroundColor:'#1a1b1a',
        marginTop:10,
        padding:2,
        marginHorizontal:80,
        marginBottom:10,
        alignItems:'center',
        borderRadius:30,
    },
    doneTxt:{
        fontSize:30,
        fontWeight:'bold',
        color:'#e9e6e6'
    },
    guarantorSub:{
        marginHorizontal:10,
        fontSize:20,
        fontWeight:'bold',
    },
    subHeader:{
        marginTop:15,
        fontSize:15,
        fontWeight:'bold',
    },
    inputReview:{
        padding:5,
        fontSize:18,
        letterSpacing:0.5,
        color:"white",
        backgroundColor:'#3b3b3b',
        borderRadius:20,
    },
    inputReviewLast:{
        padding:5,
        fontSize:18,
        letterSpacing:0.5,
        color:"white",
        backgroundColor:'#3b3b3b',
        borderRadius:20,
        marginBottom:20,
    },
    nxtBtn:{
        backgroundColor:'#1a1b1a',
        marginTop:10,
        padding:2,
        marginHorizontal:80,
        marginBottom:10,
        alignItems:'center',
        borderRadius:30,
    },
    nxtBtnIcon:{
        fontSize:50,
        color:'#ffffff'
    },
  
  })

export default styles;
