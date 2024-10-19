import { StyleSheet, useWindowDimensions} from 'react-native'

// const {height} = useWindowDimensions();

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginHorizontal:10,
        marginTop:40,
    },
    containerP:{
        flex:1,
        marginHorizontal:10,
        marginBottom:30,
        marginTop:50,
    },
    logoCon:{
        height:'20%',
        width:'70%',
        maxWidth:120,
        maxHeight:200,
        alignItems:'center',
        alignSelf:'center',
        // backgroundColor:'red',
    },
    logo:{
        width:'100%',
        height:'100%',
        resizeMode:"contain",
    },
    titleCon:{
        flexDirection:'row',
        width:300,
        alignSelf:'center'
    },
    title:{
        fontSize:22,
        fontWeight:'bold'
    },
    inputSection:{
        alignSelf:'center'
    },
    inputSub:{
        marginTop:20,
        marginBottom:5,
        fontSize:18,
    },
    input:{
        borderWidth:1,
        fontSize:16,
        padding:7,
        width:300,
        borderRadius:10,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    eyeIcon: {
        position: 'absolute',
        right: 10,
        top: 15,  // Adjust as per your design
    },
    policyContainer:{
        marginTop:10,
        marginHorizontal:18,
    },
    policyTxt:{
        lineHeight:20,
    },
    policyLink:{
        color:'#c00d0d'
    },
    btnCon:{
        width: 300,
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        alignSelf:'center',
        backgroundColor:'#045e04',
        borderRadius:10,
        marginTop:20,
    },
    btnTxt:{
        fontSize:20,
        fontWeight:'bold',
        color:'white'
    },
    secBtn_Google:{
        width: 300,
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        alignSelf:'center',
        backgroundColor:'#ce432b',
        borderRadius:10,
        marginTop:20,
    },
    text_Google:{
        fontSize:20,
        fontWeight:'bold',
        color:'#d4d0d0'
    },
    secBtn_Apple:{
        width: 300,
        padding:10,
        justifyContent:'center',
        alignItems:'center',
        alignSelf:'center',
        backgroundColor:'#5a5857',
        borderRadius:10,
        marginTop:20,
    },
    text_Apple:{
        fontSize:20,
        fontWeight:'bold',
        color:'#d4d0d0'
    },
    secBtnSection:{
        flexDirection:'row',
        alignItems:'center',
        alignSelf:'center',
        justifyContent:'space-between',
        width:300,
        marginTop:10,
    },
    secBtnCon:{
        marginTop:15,
        alignSelf:'center'
    },
    secBtnTxt:{
        fontSize:18,
        fontWeight:'bold',
        color:'#058b05'
    },
    secBtn_SECONDARY:{
        width: 150,
        borderRadius:10,
        marginTop:5,
        padding:0,
        backgroundColor:'transparent',
    },
    text_SECONDARY:{
        fontSize:18,
        fontWeight:'bold',
        color:'#058b05',
        marginBottom:20,
    },

    errorText: {
        color: 'red',
        marginBottom: 10,
    },
    errorBorder: {
        borderColor: 'red',
    },
})

export default styles;
