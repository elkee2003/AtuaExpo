import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container:{
        padding:10,
        backgroundColor:'#fff',
        height:'100%',
    },
    textInput:{
        padding:10,
        backgroundColor:'#eee',
        marginTop:40,
        marginBottom:5,
        borderRadius:20,
    },
    separator:{
        backgroundColor: '#efefef',
        height:1,
    },
    listView:{
        position:'absolute',
        top:145,
    },
    autocompleteContainer:{
        position: 'absolute',
        top: 0,
        left: 10,
        right: 10,
    },
    row:{
        flexDirection:'row',
        alignItems:'center',
        marginVertical:7,
    },
    iconContainer:{
        backgroundColor:'#a2a2a2',
        padding:5,
        borderRadius:50,
        marginRight:15
    },
    locationText:{
        
    },
    circle:{
        width:5,
        height:5,
        backgroundColor:'black',
        position:'absolute',
        top:25,
        left:15,
        borderRadius:5,
    },
    line:{
        width:1,
        height:40,
        backgroundColor:'#919191',
        position:'absolute',
        top:36,
        left:16.5,
    },
    square:{
        width:5,
        height:5,
        backgroundColor:'black',
        position:'absolute',
        top:80,
        left:15,
    },
    topButton:{
        position: 'absolute',
        top:50,
        right:4,
        zIndex:2,
        color:'#928f8f',
        fontSize:25,
        // justifyContent: 'center', 
        // alignItems: 'center', 
        // marginLeft: 10 
    },
    bottomButton:{
        position: 'absolute',
        top:53,
        right:4,
        fontSize:25,
        zIndex:2,
        color:'#928f8f',
        // justifyContent: 'center', 
        // alignItems: 'center', 
        // marginLeft: 10 
    },
    gPoweredContainer:{
        display:'none'
    },
    activityIndicator:{
        position: 'absolute',
        top: '50%',
        left: '50%',
        zIndex:3
    }
})

export default styles;