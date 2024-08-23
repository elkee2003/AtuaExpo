import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container:{
        flexDirection: 'row',
        alignItems:'center',
        padding:20,
        borderBottomWidth:1,
        borderColor:'#f3f1f1'
    },
    selectedContainer:{
        backgroundColor:'#e9e7e7'
    },
    image:{
        height:70,
        width:80,
        resizeMode:'contain'
    },
    middleContainer:{
        flex:1,
        marginHorizontal:10,
    },
    rightContainer:{
        width:100,
        justifyContent:'flex-end',
        alignItems:'center',
        flexDirection:'row',
    },
    type:{
        fontWeight:'bold',
        fontSize:18,
        marginBottom:5,
    },
    time:{
        color:'#5d5d5d'
    },
    price:{
        fontWeight:'bold',
        fontSize:18,
        marginLeft:5,
    },
    confirmBtn:{
        justifyContent:'center',
        alignItems:'center',
        padding:5,
        borderRadius:20,
        backgroundColor:'#01a70f',
        marginHorizontal:20,
        marginBottom:30
    },
    confirmTxt:{
        textAlign:'center',
        fontSize:30,
        fontWeight:'bold'
    }
})

export default styles;