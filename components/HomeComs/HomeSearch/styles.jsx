import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    inputBox:{
        backgroundColor: '#dad8d8',
        borderRadius:20,
        margin: 10,
        padding:10,
        flexDirection: 'row',
        justifyContent:'space-between',
        alignItems:'center'
    },
    inputText:{
        fontSize: 20,
        fontWeight:'600',
        color: '#535353'
    },
    orderContainer:{
        flexDirection:'row',
        justifyContent: 'center',
        width:70,
        padding:5,
        backgroundColor:'#fff',
        borderRadius:50
    },
    row:{
        flexDirection: 'row',
        alignItems: 'center',
        padding:10,
        borderBottomWidth:1,
        borderColor:'#dbdbdb'
    },
    iconContainer:{
        backgroundColor:'#b3b3b3',
        padding:20,
        borderRadius:50
    },
    destinationText:{
        marginLeft:10,
        fontWeight:'500',
        fontSize:16,
    }
})

export default styles