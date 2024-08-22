import { StyleSheet, } from 'react-native'


const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:30,
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        margin: 10,
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
        fontSize:60
    },
    input: {
        margin: 10,
        backgroundColor: "white",
        padding: 15,
        borderRadius: 5,
    },
    error:{
        color:'#d80b0b',
        fontSize:13,
        marginTop:-10,
        marginHorizontal:15,
        marginBottom:5,
    },
    saveBackground:{
        alignItems:'center',
        backgroundColor:'#18b403',
        padding: 15,
    },
    scrnBtns:{
        marginTop:30,
        marginBottom:10,
        gap:15
    },
    saveBtn:{
        backgroundColor:'#0fcf0f',
        padding:10,
        marginHorizontal:40,
        alignItems:'center',
        borderRadius:30,
    },
    saveTxt:{
        fontSize:25,
        color:'#ffffff'
    },
    signoutBtn:{
        padding:10,
        marginHorizontal:'auto',
        alignItems:'center',
        borderRadius:30,
    },
        signoutTxt:{
        fontSize:20,
        color:'#c70707'
    }
  
  })

export default styles
