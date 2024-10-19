import { StyleSheet, } from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:30,
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
    signoutBtn:{
        position:'absolute',
        top:10,
        right:10,
    },
    signoutTxt:{
        fontSize:18,
        fontWeight:'bold',
        color:'#c90707',
    },
    centerCon:{
        // top:'20%',
        justifyContent:'center',
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
        marginTop:10,
        marginBottom:20,
    },
    img:{
        width:'100%',
        height:'100%',
        resizeMode:"contain",
        borderRadius:75,
    },
    details:{
        textAlign:'center',
        fontWeight:'bold',
        fontSize:17,
    },
    mainBtnRow:{
        flexDirection:"row",
        gap:20,
        justifyContent:'center',
        marginHorizontal:10,
    },
    mainBtnsCard:{
        marginVertical:10,
        padding:20,
        borderRadius:20,
        backgroundColor:'#c5c5c5',
        gap:10,
        alignSelf:'center',
    },
    viewInfo:{
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'black',
        borderRadius:20,
    },
    viewInfoText:{
        color:'white',
        fontSize:18,
        fontWeight:"bold",
    },
    editProfile:{
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'transparent',
        borderWidth:1,
        borderColor:'black',
        borderRadius:20,
    },
    
    editProfileTxt:{
        color:'black',
        fontSize:18,
        fontWeight:'bold',
    },
    tetiaryCard:{
        margin:10,
        padding:20,
        borderRadius:20,
        backgroundColor:'#c5c5c5',
        gap:10,
        alignSelf:'center',
    },
    btnTetiary:{
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'transparent',
        borderWidth:1,
        borderColor:'black',
        borderRadius:20,
    },
    btnTetiaryTxt:{
        fontWeight:'bold',
        fontSize:18,
    },
})

export default styles
